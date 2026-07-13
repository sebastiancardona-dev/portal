package dev.sebastiancardona.portal.data;

import dev.sebastiancardona.portal.config.PortalProps;
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
 * {@code diskPath} names the filesystem path the disk numbers were sampled at,
 * so the UI can say WHAT is being measured (null while no disk data exists).
 */
@RestController
@RequestMapping("/api/host")
public class HostController {

    private final SeriesService series;
    private final PortalProps props;

    public HostController(SeriesService series, PortalProps props) {
        this.series = series;
        this.props = props;
    }

    public record ContainerStatDto(String name, Double cpuPct, Long memBytes) {
    }

    public record HostDto(Instant ts, Double cpuPct, Long memUsedBytes, Long memTotalBytes,
                          Long diskUsedBytes, Long diskTotalBytes, String diskPath,
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
        Long diskUsed = longOf(host.get("disk_used_bytes"));
        Long diskTotal = longOf(host.get("disk_total_bytes"));
        return new HostDto(ts,
                doubleOf(host.get("cpu_pct")),
                longOf(host.get("mem_used_bytes")),
                longOf(host.get("mem_total_bytes")),
                diskUsed,
                diskTotal,
                diskUsed == null && diskTotal == null ? null : props.host().diskPath(),
                containers);
    }

    private static Double doubleOf(Point point) {
        return point == null ? null : point.value();
    }

    private static Long longOf(Point point) {
        return point == null ? null : (long) point.value();
    }
}
