package dev.sebastiancardona.portal.logs;

import com.fasterxml.jackson.databind.JsonNode;
import dev.sebastiancardona.portal.common.ApiExceptions.UpstreamException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Thin Loki HTTP API client (DockerClient pattern: optional by construction —
 * a blank URL means the logs pipeline isn't connected in this environment, and
 * the module says so instead of pretending). All queries are read-only.
 */
@Component
public class LokiClient {

    private final RestClient http; // null = unconfigured
    private final String baseUrl;

    public LokiClient(@Value("${portal.loki.url:}") String url) {
        if (url == null || url.isBlank()) {
            this.http = null;
            this.baseUrl = null;
        } else {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(Duration.ofSeconds(3));
            factory.setReadTimeout(Duration.ofSeconds(15));
            this.http = RestClient.builder().requestFactory(factory).build();
            this.baseUrl = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        }
    }

    public boolean configured() {
        return http != null;
    }

    /** Log lines. Loki wants nanosecond timestamps on this endpoint. */
    public JsonNode queryRange(String logql, Instant start, Instant end, int limit, boolean forward) {
        return call("/loki/api/v1/query_range?query=" + encode(logql)
                + "&start=" + nanos(start) + "&end=" + nanos(end)
                + "&limit=" + limit + "&direction=" + (forward ? "forward" : "backward"));
    }

    /** Metric series (compiled summarize-by-bin queries). */
    public JsonNode queryRangeMetric(String logql, Instant start, Instant end, Duration step) {
        return call("/loki/api/v1/query_range?query=" + encode(logql)
                + "&start=" + nanos(start) + "&end=" + nanos(end)
                + "&step=" + step.toSeconds() + "s");
    }

    /** Instant vector (totals / top-N over the whole range). */
    public JsonNode queryInstant(String logql, Instant time) {
        return call("/loki/api/v1/query?query=" + encode(logql) + "&time=" + nanos(time));
    }

    public List<String> labelValues(String label, Instant start, Instant end) {
        JsonNode body = call("/loki/api/v1/label/" + encode(label) + "/values"
                + "?start=" + nanos(start) + "&end=" + nanos(end));
        List<String> values = new ArrayList<>();
        for (JsonNode v : body.path("data")) {
            values.add(v.asText());
        }
        return values;
    }

    /**
     * URIs are assembled by hand: LogQL is full of {braces}, which every Spring
     * UriBuilder path treats as template variables ("not enough variable values"
     * — found the hard way on the first rendered query).
     */
    private JsonNode call(String pathAndQuery) {
        if (http == null) {
            throw new UpstreamException(503, "logs pipeline not connected in this environment");
        }
        try {
            JsonNode body = http.get().uri(java.net.URI.create(baseUrl + pathAndQuery))
                    .retrieve().body(JsonNode.class);
            if (body == null || !"success".equals(body.path("status").asText())) {
                throw new UpstreamException(502, "loki returned an unexpected response");
            }
            return body;
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            // Loki 400s carry the LogQL parse error — surface it, it's actionable
            throw new UpstreamException(e.getStatusCode().value(),
                    e.getResponseBodyAsString().isBlank() ? "loki error" : e.getResponseBodyAsString());
        } catch (RestClientException e) {
            throw new UpstreamException(502, "loki unreachable");
        }
    }

    private static String nanos(Instant instant) {
        return instant.getEpochSecond() + String.format("%09d", instant.getNano());
    }

    private static String encode(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }
}
