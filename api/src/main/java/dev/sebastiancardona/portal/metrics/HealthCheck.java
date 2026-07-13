package dev.sebastiancardona.portal.metrics;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** One health probe result — uptime history raw data (14d retention). */
@Entity
@Table(name = "health_checks")
public class HealthCheck {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private Instant ts;

    @Column(nullable = false)
    private String app;

    @Column(nullable = false)
    private String env;

    @Column(nullable = false)
    private boolean up;

    @Column(name = "http_status")
    private Integer httpStatus;

    @Column(name = "latency_ms")
    private Long latencyMs;

    protected HealthCheck() {
    }

    public HealthCheck(Instant ts, String app, String env, boolean up,
                       Integer httpStatus, Long latencyMs) {
        this.ts = ts;
        this.app = app;
        this.env = env;
        this.up = up;
        this.httpStatus = httpStatus;
        this.latencyMs = latencyMs;
    }

    public UUID getId() {
        return id;
    }

    public Instant getTs() {
        return ts;
    }

    public String getApp() {
        return app;
    }

    public String getEnv() {
        return env;
    }

    public boolean isUp() {
        return up;
    }

    public Integer getHttpStatus() {
        return httpStatus;
    }

    public Long getLatencyMs() {
        return latencyMs;
    }
}
