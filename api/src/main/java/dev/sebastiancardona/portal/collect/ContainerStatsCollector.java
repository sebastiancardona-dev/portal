package dev.sebastiancardona.portal.collect;

import dev.sebastiancardona.portal.discovery.DockerClient;
import dev.sebastiancardona.portal.discovery.DockerClient.ContainerSummary;
import dev.sebastiancardona.portal.metrics.MetricPoint;
import dev.sebastiancardona.portal.metrics.MetricPointRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Per-container CPU/RAM via the socket proxy's one-shot stats endpoint.
 * Skipped entirely when the docker api is unconfigured (dev machine).
 */
@Component
public class ContainerStatsCollector {

    private static final Logger log = LoggerFactory.getLogger(ContainerStatsCollector.class);

    private final DockerClient docker;
    private final MetricPointRepository points;

    public ContainerStatsCollector(DockerClient docker, MetricPointRepository points) {
        this.docker = docker;
        this.points = points;
    }

    @Scheduled(fixedDelayString = "${portal.collect.container-interval-ms:60000}",
            initialDelayString = "${portal.collect.initial-delay-ms:5000}")
    public void collect() {
        if (!docker.configured()) {
            return;
        }
        Instant ts = Instant.now();
        for (ContainerSummary container : docker.listContainers()) {
            if (!"running".equalsIgnoreCase(container.state()) || container.name().isBlank()) {
                continue;
            }
            try {
                docker.stats(container.id()).ifPresent(stats -> {
                    String source = "container:" + container.name();
                    points.save(new MetricPoint(ts, source, "cpu_pct", stats.cpuPct()));
                    points.save(new MetricPoint(ts, source, "mem_bytes", stats.memBytes()));
                });
            } catch (Exception e) {
                log.debug("container stats failed for {}: {}", container.name(), e.toString());
            }
        }
    }
}
