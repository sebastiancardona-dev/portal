package dev.sebastiancardona.portal.metrics;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Time-bucketed reads over metric_points/health_checks (Postgres-as-TSDB — a
 * deliberate trade-off, see DESIGN.md; date_bin keeps bucketing in one pass).
 */
@Service
public class SeriesService {

    private final JdbcClient jdbc;

    public SeriesService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public record Point(Instant ts, double value) {
    }

    /** Bucketed average of one metric series. */
    public List<Point> metricSeries(String source, String metric, Duration range,
                                    Duration bucket) {
        return jdbc.sql("""
                        select date_bin(cast(? as interval), ts, timestamptz '2000-01-01'),
                               avg(value)
                        from metric_points
                        where source = ? and metric = ? and ts >= ?
                        group by 1 order by 1
                        """)
                .params(interval(bucket), source, metric, from(range))
                .query(SeriesService::point)
                .list();
    }

    /** Bucketed availability (0..1) or average latency (ms) for an app+env. */
    public List<Point> healthSeries(String app, String env, boolean latency,
                                    Duration range, Duration bucket) {
        String value = latency
                ? "avg(latency_ms)"
                : "avg(case when up then 1.0 else 0.0 end)";
        String filter = latency ? " and latency_ms is not null" : "";
        return jdbc.sql("select date_bin(cast(? as interval), ts, timestamptz '2000-01-01'), "
                        + value + " from health_checks"
                        + " where app = ? and env = ? and ts >= ?" + filter
                        + " group by 1 order by 1")
                .params(interval(bucket), app, env, from(range))
                .query(SeriesService::point)
                .list();
    }

    /** Hourly uptime percentage over the last 7 days, all envs of the app together. */
    public List<Point> uptime7d(String app) {
        return jdbc.sql("""
                        select date_bin(interval '1 hour', ts, timestamptz '2000-01-01'),
                               avg(case when up then 100.0 else 0.0 end)
                        from health_checks
                        where app = ? and ts >= ?
                        group by 1 order by 1
                        """)
                .params(app, from(Duration.ofDays(7)))
                .query(SeriesService::point)
                .list();
    }

    public Optional<Point> latestMetric(String source, String metric) {
        return jdbc.sql("select ts, value from metric_points where source = ? and metric = ?"
                        + " order by ts desc limit 1")
                .params(source, metric)
                .query(SeriesService::point)
                .optional();
    }

    /** Which host metrics have ever been recorded (drives source enumeration). */
    public List<String> hostMetrics() {
        return jdbc.sql("select distinct metric from metric_points where source = 'host'"
                        + " order by metric")
                .query(String.class)
                .list();
    }

    /** Latest point per (container, metric): name → metric → point. */
    public Map<String, Map<String, Point>> latestContainerMetrics() {
        Map<String, Map<String, Point>> byContainer = new LinkedHashMap<>();
        jdbc.sql("""
                        select distinct on (source, metric) source, metric, ts, value
                        from metric_points where source like 'container:%'
                        order by source, metric, ts desc
                        """)
                .query(rs -> {
                    while (rs.next()) {
                        String name = rs.getString(1).substring("container:".length());
                        byContainer.computeIfAbsent(name, k -> new LinkedHashMap<>())
                                .put(rs.getString(2), new Point(
                                        rs.getObject(3, OffsetDateTime.class).toInstant(),
                                        rs.getDouble(4)));
                    }
                    return byContainer;
                });
        return byContainer;
    }

    /** Latest point per host metric. */
    public Map<String, Point> latestHostMetrics() {
        Map<String, Point> byMetric = new LinkedHashMap<>();
        jdbc.sql("""
                        select distinct on (metric) metric, ts, value
                        from metric_points where source = 'host'
                        order by metric, ts desc
                        """)
                .query(rs -> {
                    while (rs.next()) {
                        byMetric.put(rs.getString(1), new Point(
                                rs.getObject(2, OffsetDateTime.class).toInstant(),
                                rs.getDouble(3)));
                    }
                    return byMetric;
                });
        return byMetric;
    }

    /** Row mapper for (timestamp, value) shaped queries. */
    private static Point point(ResultSet rs, int rowNum) throws SQLException {
        return new Point(rs.getObject(1, OffsetDateTime.class).toInstant(), rs.getDouble(2));
    }

    private static String interval(Duration bucket) {
        return bucket.toSeconds() + " seconds";
    }

    private static OffsetDateTime from(Duration range) {
        return OffsetDateTime.ofInstant(Instant.now().minus(range), ZoneOffset.UTC);
    }
}
