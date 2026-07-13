package dev.sebastiancardona.portal.metrics;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Nightly delete of raw points/checks older than the retention window (14d).
 * Rollups only if the 7d views ever get slow — YAGNI at ~1.6M rows.
 */
@Component
public class RetentionJob {

    private static final Logger log = LoggerFactory.getLogger(RetentionJob.class);

    private final MetricPointRepository metricPoints;
    private final HealthCheckRepository healthChecks;
    private final int retentionDays;

    public RetentionJob(MetricPointRepository metricPoints, HealthCheckRepository healthChecks,
                        @Value("${portal.retention.days:14}") int retentionDays) {
        this.metricPoints = metricPoints;
        this.healthChecks = healthChecks;
        this.retentionDays = retentionDays;
    }

    @Scheduled(cron = "${portal.retention.cron:0 0 4 * * *}")
    @Transactional
    public void purge() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(retentionDays));
        long points = metricPoints.deleteByTsBefore(cutoff);
        long checks = healthChecks.deleteByTsBefore(cutoff);
        log.info("retention purge: {} metric points, {} health checks older than {}d",
                points, checks, retentionDays);
    }
}
