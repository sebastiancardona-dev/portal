package dev.sebastiancardona.portal.logs;

import com.fasterxml.jackson.databind.JsonNode;
import dev.sebastiancardona.portal.logs.dql.Dql;
import dev.sebastiancardona.portal.logs.dql.LogQlCompiler;
import dev.sebastiancardona.portal.logs.dql.LogQlCompiler.Compiled;
import dev.sebastiancardona.portal.logs.dql.Parser;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Executes DQL against Loki and flattens the responses into the wire shapes
 * the SPA renders. One query path only: the filter UI builds DQL, the query
 * bar edits the same DQL — what you see is what runs.
 */
@Service
public class LogsService {

    public record LogEntry(Instant ts, String line, Map<String, String> labels) {}

    public record SeriesPoint(Instant ts, double value) {}

    public record LogSeries(Map<String, String> labels, List<SeriesPoint> points) {}

    public record LogTotal(Map<String, String> labels, double value) {}

    /** kind decides which list is populated; logql is echoed for transparency. */
    public record LogsResult(String kind, String logql, List<LogEntry> entries,
                             List<LogSeries> series, List<LogTotal> totals) {}

    private static final int DEFAULT_LOG_LIMIT = 200;
    private static final int MAX_LOG_LIMIT = 1000;

    private final LokiClient loki;

    public LogsService(LokiClient loki) {
        this.loki = loki;
    }

    public boolean available() {
        return loki.configured();
    }

    public LogsResult run(String dql, Duration range, Instant end) {
        Dql.Query query = Parser.parse(dql);
        Compiled compiled = LogQlCompiler.compile(query, range);
        Instant start = end.minus(range);
        return switch (compiled.kind()) {
            case LOGS -> {
                int limit = Math.min(compiled.limit() == null ? DEFAULT_LOG_LIMIT : compiled.limit(),
                        MAX_LOG_LIMIT);
                JsonNode body = loki.queryRange(compiled.logql(), start, end, limit, compiled.forward());
                yield new LogsResult("logs", compiled.logql(),
                        entries(body, compiled.forward()), List.of(), List.of());
            }
            case SERIES -> {
                JsonNode body = loki.queryRangeMetric(compiled.logql(), start, end, compiled.step());
                yield new LogsResult("series", compiled.logql(), List.of(), series(body), List.of());
            }
            case TOTALS -> {
                JsonNode body = loki.queryInstant(compiled.logql(), end);
                yield new LogsResult("totals", compiled.logql(), List.of(), List.of(), totals(body));
            }
        };
    }

    /** Live tail = the same LOGS query, forward from the last seen timestamp. */
    public List<LogEntry> tail(String dql, Instant since, Instant now) {
        Compiled compiled = LogQlCompiler.compile(Parser.parse(dql), Duration.between(since, now));
        if (compiled.kind() != LogQlCompiler.Kind.LOGS) {
            throw new dev.sebastiancardona.portal.logs.dql.DqlException(
                    "live tail follows raw log queries — drop the summarize stage", 0);
        }
        JsonNode body = loki.queryRange(compiled.logql(), since, now, 500, true);
        return entries(body, true);
    }

    // ===== Loki response flattening =====

    private static List<LogEntry> entries(JsonNode body, boolean forward) {
        List<LogEntry> out = new ArrayList<>();
        for (JsonNode stream : body.path("data").path("result")) {
            Map<String, String> labels = labels(stream.path("stream"));
            for (JsonNode value : stream.path("values")) {
                out.add(new LogEntry(fromNanos(value.get(0).asText()),
                        value.get(1).asText(), labels));
            }
        }
        // streams arrive separately — merge into one timeline
        out.sort(forward ? Comparator.comparing(LogEntry::ts)
                : Comparator.comparing(LogEntry::ts).reversed());
        return out;
    }

    private static List<LogSeries> series(JsonNode body) {
        List<LogSeries> out = new ArrayList<>();
        for (JsonNode result : body.path("data").path("result")) {
            List<SeriesPoint> points = new ArrayList<>();
            for (JsonNode value : result.path("values")) {
                points.add(new SeriesPoint(Instant.ofEpochSecond(value.get(0).asLong()),
                        value.get(1).asDouble()));
            }
            out.add(new LogSeries(labels(result.path("metric")), points));
        }
        return out;
    }

    private static List<LogTotal> totals(JsonNode body) {
        List<LogTotal> out = new ArrayList<>();
        for (JsonNode result : body.path("data").path("result")) {
            out.add(new LogTotal(labels(result.path("metric")),
                    result.path("value").path(1).asDouble()));
        }
        out.sort(Comparator.comparingDouble(LogTotal::value).reversed());
        return out;
    }

    private static Map<String, String> labels(JsonNode node) {
        Map<String, String> labels = new LinkedHashMap<>();
        node.properties().forEach(e -> {
            // internal plumbing labels add noise, not signal
            if (!e.getKey().equals("job") && !e.getKey().equals("service_name")) {
                labels.put(e.getKey(), e.getValue().asText());
            }
        });
        return labels;
    }

    private static Instant fromNanos(String nanos) {
        long value = Long.parseLong(nanos);
        return Instant.ofEpochSecond(value / 1_000_000_000L, value % 1_000_000_000L);
    }
}
