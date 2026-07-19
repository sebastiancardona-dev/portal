package dev.sebastiancardona.portal.releases;

import com.fasterxml.jackson.databind.JsonNode;
import dev.sebastiancardona.portal.common.ApiExceptions.UpstreamException;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Read-only GitHub REST client (LokiClient pattern: optional by construction —
 * a blank token means the releases module isn't connected in this environment).
 * Conditional requests: a stored ETag turns an unchanged repo into a 304 that
 * doesn't count against the rate limit.
 */
@Component
public class GitHubClient {

    private final RestClient http; // null = unconfigured
    private final String apiUrl;
    private final String org;
    private final String token;

    public GitHubClient(@Value("${portal.github.token:}") String token,
                        @Value("${portal.github.org:sebastiancardona-dev}") String org,
                        @Value("${portal.github.api-url:https://api.github.com}") String apiUrl) {
        this.org = org;
        this.apiUrl = apiUrl.endsWith("/") ? apiUrl.substring(0, apiUrl.length() - 1) : apiUrl;
        if (token == null || token.isBlank()) {
            this.http = null;
            this.token = null;
        } else {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(Duration.ofSeconds(3));
            factory.setReadTimeout(Duration.ofSeconds(15));
            this.http = RestClient.builder().requestFactory(factory).build();
            this.token = token.strip();
        }
    }

    public boolean configured() {
        return http != null;
    }

    public String org() {
        return org;
    }

    /** body == null means 304: the cached rows are still current. */
    public record ReleasesPage(String etag, JsonNode body) {
    }

    public ReleasesPage listReleases(String repo, String etag) {
        if (http == null) {
            throw new UpstreamException(503, "releases module not connected in this environment");
        }
        try {
            var response = http.get()
                    .uri(java.net.URI.create(apiUrl + "/repos/" + org + "/" + repo
                            + "/releases?per_page=100"))
                    .headers(h -> {
                        h.setBearerAuth(token);
                        h.set("Accept", "application/vnd.github+json");
                        h.set("X-GitHub-Api-Version", "2022-11-28");
                        if (etag != null) {
                            h.set("If-None-Match", etag);
                        }
                    })
                    .retrieve()
                    .toEntity(JsonNode.class);
            // 304 (not an error status, sails through retrieve()): cache is current
            if (response.getStatusCode().value() == 304) {
                return new ReleasesPage(etag, null);
            }
            return new ReleasesPage(response.getHeaders().getETag(), response.getBody());
        } catch (HttpClientErrorException e) {
            // 404 = repo renamed/removed or the PAT lacks access — actionable, not fatal
            throw new UpstreamException(e.getStatusCode().value(),
                    "github " + e.getStatusCode().value() + " for " + org + "/" + repo);
        } catch (RestClientException e) {
            throw new UpstreamException(502, "github unreachable");
        }
    }
}
