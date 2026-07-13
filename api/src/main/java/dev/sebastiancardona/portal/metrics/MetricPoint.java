package dev.sebastiancardona.portal.metrics;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * One sample of a host/container series. source: `host` or `container:<name>`;
 * metric: `cpu_pct`, `mem_bytes`, `mem_used_bytes`, `disk_used_bytes`, …
 */
@Entity
@Table(name = "metric_points")
public class MetricPoint {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private Instant ts;

    @Column(nullable = false)
    private String source;

    @Column(nullable = false)
    private String metric;

    @Column(nullable = false)
    private double value;

    protected MetricPoint() {
    }

    public MetricPoint(Instant ts, String source, String metric, double value) {
        this.ts = ts;
        this.source = source;
        this.metric = metric;
        this.value = value;
    }

    public UUID getId() {
        return id;
    }

    public Instant getTs() {
        return ts;
    }

    public String getSource() {
        return source;
    }

    public String getMetric() {
        return metric;
    }

    public double getValue() {
        return value;
    }
}
