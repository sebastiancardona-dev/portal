package dev.sebastiancardona.portal.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import dev.sebastiancardona.portal.config.PortalProps;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Read-only Docker runtime view through the tecnativa socket proxy (CONTAINERS=1,
 * everything else blocked — the portal can see, never change). The proxy URL is
 * optional: blank (dev machine) or unreachable means Docker discovery is skipped.
 */
@Component
public class DockerClient {

    private static final Logger log = LoggerFactory.getLogger(DockerClient.class);

    private final RestClient http; // null = unconfigured
    private final AtomicBoolean failLogged = new AtomicBoolean();

    public DockerClient(PortalProps props) {
        String baseUrl = props.docker() == null || props.docker().api() == null
                ? "" : props.docker().api().strip();
        if (baseUrl.isBlank()) {
            this.http = null;
        } else {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(Duration.ofSeconds(2));
            factory.setReadTimeout(Duration.ofSeconds(5));
            this.http = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        }
    }

    public boolean configured() {
        return http != null;
    }

    public record ContainerSummary(String id, String name, String state,
                                   Map<String, String> labels) {
    }

    public record ContainerStats(double cpuPct, long memBytes) {
    }

    /** All containers (running or not); empty when unconfigured or unreachable. */
    public List<ContainerSummary> listContainers() {
        if (http == null) {
            return List.of();
        }
        try {
            JsonNode root = http.get().uri("/containers/json?all=true")
                    .retrieve().body(JsonNode.class);
            List<ContainerSummary> containers = new ArrayList<>();
            if (root != null && root.isArray()) {
                for (JsonNode c : root) {
                    containers.add(parseContainer(c));
                }
            }
            return containers;
        } catch (Exception e) {
            if (failLogged.compareAndSet(false, true)) {
                log.debug("docker api unreachable — skipping this source: {}", e.toString());
            }
            return List.of();
        }
    }

    /** One-shot stats sample; empty on any failure. */
    public Optional<ContainerStats> stats(String containerId) {
        if (http == null) {
            return Optional.empty();
        }
        try {
            JsonNode stats = http.get().uri("/containers/{id}/stats?stream=false", containerId)
                    .retrieve().body(JsonNode.class);
            return stats == null ? Optional.empty() : Optional.of(parseStats(stats));
        } catch (Exception e) {
            log.debug("stats fetch failed for {}: {}", containerId, e.toString());
            return Optional.empty();
        }
    }

    static ContainerSummary parseContainer(JsonNode c) {
        String name = "";
        JsonNode names = c.path("Names");
        if (names.isArray() && !names.isEmpty()) {
            name = names.get(0).asText("");
            if (name.startsWith("/")) {
                name = name.substring(1);
            }
        }
        Map<String, String> labels = new HashMap<>();
        c.path("Labels").properties()
                .forEach(entry -> labels.put(entry.getKey(), entry.getValue().asText("")));
        return new ContainerSummary(c.path("Id").asText(""), name,
                c.path("State").asText(""), labels);
    }

    static ContainerStats parseStats(JsonNode stats) {
        JsonNode cpu = stats.path("cpu_stats");
        JsonNode precpu = stats.path("precpu_stats");
        int onlineCpus = cpu.path("online_cpus").asInt(0);
        if (onlineCpus == 0) {
            onlineCpus = cpu.path("cpu_usage").path("percpu_usage").size();
        }
        double cpuPct = computeCpuPct(
                cpu.path("cpu_usage").path("total_usage").asLong(0),
                precpu.path("cpu_usage").path("total_usage").asLong(0),
                cpu.path("system_cpu_usage").asLong(0),
                precpu.path("system_cpu_usage").asLong(0),
                onlineCpus);
        return new ContainerStats(cpuPct, stats.path("memory_stats").path("usage").asLong(0));
    }

    /** The standard `docker stats` delta formula: (cpuΔ/systemΔ) * onlineCpus * 100. */
    public static double computeCpuPct(long cpuTotal, long precpuTotal,
                                       long systemTotal, long presystemTotal, int onlineCpus) {
        long cpuDelta = cpuTotal - precpuTotal;
        long systemDelta = systemTotal - presystemTotal;
        if (cpuDelta <= 0 || systemDelta <= 0 || onlineCpus <= 0) {
            return 0.0;
        }
        return (double) cpuDelta / systemDelta * onlineCpus * 100.0;
    }
}
