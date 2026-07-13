package dev.sebastiancardona.portal.data;

import dev.sebastiancardona.portal.metrics.SeriesService;
import dev.sebastiancardona.portal.metrics.SeriesService.Point;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Latest host snapshot with per-container breakdown. Fields are null (and the
 * container list empty) until the collectors have data — e.g. on a dev machine.
 */
@RestController
@RequestMapping("/api/host")
public class HostController {

    private final SeriesService series;

    public HostController(SeriesService series) {
        this.series = series;
    }

    public record ContainerStatDto(String name, Double cpuPct, Long memBytes) {
    }

    public record HostDto(Instant ts, Double cpuPct, Long memUsedBytes, Long memTotalBytes,
                          Long diskUsedBytes, Long diskTotalBytes,
                          List<ContainerStatDto> containers) {
    }

    @GetMapping
    HostDto host() {
        Map<String, Point> host = series.latestHostMetrics();
        Instant ts = host.values().stream().map(Point::ts).max(Instant::compareTo).orElse(null);
        List<ContainerStatDto> containers = series.latestContainerMetrics().entrySet().stream()
                .map(entry -> {
                    Point cpu = entry.getValue().get("cpu_pct");
                    Point mem = entry.getValue().get("mem_bytes");
                    return new ContainerStatDto(entry.getKey(),
                            cpu == null ? null : cpu.value(),
                            mem == null ? null : (long) mem.value());
                })
                .toList();
        return new HostDto(ts,
                doubleOf(host.get("cpu_pct")),
                longOf(host.get("mem_used_bytes")),
                longOf(host.get("mem_total_bytes")),
                longOf(host.get("disk_used_bytes")),
                longOf(host.get("disk_total_bytes")),
                containers);
    }

    private static Double doubleOf(Point point) {
        return point == null ? null : point.value();
    }

    private static Long longOf(Point point) {
        return point == null ? null : (long) point.value();
    }
}
