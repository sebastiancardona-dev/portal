package dev.sebastiancardona.portal.data;

import com.fasterxml.jackson.annotation.JsonInclude;
import dev.sebastiancardona.portal.common.ApiExceptions.NotFoundException;
import dev.sebastiancardona.portal.data.SourceId.Kind;
import dev.sebastiancardona.portal.discovery.AppCatalog;
import dev.sebastiancardona.portal.discovery.AppCatalog.CatalogApp;
import dev.sebastiancardona.portal.metrics.HealthCheckRepository;
import dev.sebastiancardona.portal.metrics.SeriesService;
import dev.sebastiancardona.portal.metrics.SeriesService.Point;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * The data-source API: enumerate, latest, series. Sources are enumerated
 * dynamically — app+env pairs from discovery, host/container series from what
 * the collectors actually recorded (absent sources simply don't appear).
 */
@RestController
@RequestMapping("/api/sources")
public class SourcesController {

    private static final Duration DEFAULT_RANGE = Duration.ofHours(6);
    private static final Duration DEFAULT_BUCKET = Duration.ofMinutes(5);

    private final AppCatalog catalog;
    private final SeriesService series;
    private final HealthCheckRepository healthChecks;

    public SourcesController(AppCatalog catalog, SeriesService series,
                             HealthCheckRepository healthChecks) {
        this.catalog = catalog;
        this.series = series;
        this.healthChecks = healthChecks;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SourceView(String id, String kind, String label, String unit, String app) {
    }

    public record PointView(java.time.Instant ts, Double value) {

        static PointView of(Point p) {
            return new PointView(p.ts(), p.value());
        }
    }

    @GetMapping
    List<SourceView> sources() {
        List<SourceView> sources = new ArrayList<>();
        for (CatalogApp app : catalog.apps()) {
            for (String env : app.environments().keySet()) {
                sources.add(new SourceView("health:" + app.app() + ":" + env, "status",
                        app.displayName() + " " + env + " health", null, app.app()));
                sources.add(new SourceView("latency:" + app.app() + ":" + env, "gauge",
                        app.displayName() + " " + env + " latency", "ms", app.app()));
            }
        }
        for (String metric : series.hostMetrics()) {
            sources.add(new SourceView("host:" + metric, "gauge",
                    "host " + metric, unitFor(metric), null));
        }
        series.latestContainerMetrics().forEach((name, metrics) ->
                metrics.keySet().forEach(metric ->
                        sources.add(new SourceView("container:" + name + ":" + metric, "gauge",
                                name + " " + metric, unitFor(metric), null))));
        return sources;
    }

    @GetMapping("/{id}/latest")
    PointView latest(@PathVariable String id) {
        SourceId source = parse(id);
        return latestPoint(source).map(PointView::of)
                .orElseThrow(() -> new NotFoundException("no data for source " + id));
    }

    @GetMapping("/{id}/series")
    List<PointView> series(@PathVariable String id,
                           @RequestParam(required = false) String range,
                           @RequestParam(required = false) String bucket) {
        SourceId source = parse(id);
        Duration rangeDuration = Ranges.parse(range, DEFAULT_RANGE);
        Duration bucketDuration = Ranges.parse(bucket, DEFAULT_BUCKET);
        List<Point> points = switch (source.kind()) {
            case HEALTH -> series.healthSeries(source.app(), source.env(), false,
                    rangeDuration, bucketDuration);
            case LATENCY -> series.healthSeries(source.app(), source.env(), true,
                    rangeDuration, bucketDuration);
            case HOST -> series.metricSeries("host", source.metric(),
                    rangeDuration, bucketDuration);
            case CONTAINER -> series.metricSeries("container:" + source.container(),
                    source.metric(), rangeDuration, bucketDuration);
        };
        return points.stream().map(PointView::of).toList();
    }

    private Optional<Point> latestPoint(SourceId source) {
        return switch (source.kind()) {
            case HEALTH -> healthChecks
                    .findTopByAppAndEnvOrderByTsDesc(source.app(), source.env())
                    .map(check -> new Point(check.getTs(), check.isUp() ? 1.0 : 0.0));
            case LATENCY -> healthChecks
                    .findTopByAppAndEnvOrderByTsDesc(source.app(), source.env())
                    .filter(check -> check.getLatencyMs() != null)
                    .map(check -> new Point(check.getTs(), check.getLatencyMs()));
            case HOST -> series.latestMetric("host", source.metric());
            case CONTAINER -> series.latestMetric("container:" + source.container(),
                    source.metric());
        };
    }

    private static SourceId parse(String id) {
        return SourceId.parse(id)
                .orElseThrow(() -> new NotFoundException("unknown source " + id));
    }

    static String unitFor(String metric) {
        if (metric == null) {
            return null;
        }
        if (metric.endsWith("_pct")) {
            return "%";
        }
        if (metric.endsWith("_bytes") || metric.equals("mem_bytes")) {
            return "bytes";
        }
        return null;
    }
}
