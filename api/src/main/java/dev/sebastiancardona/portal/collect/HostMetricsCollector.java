package dev.sebastiancardona.portal.collect;

import dev.sebastiancardona.portal.config.PortalProps;
import dev.sebastiancardona.portal.metrics.MetricPoint;
import dev.sebastiancardona.portal.metrics.MetricPointRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Samples host CPU/RAM from the read-only /host/proc mount and disk usage from
 * a FileStore. All paths are optional — on a dev machine nothing exists and the
 * collector is silently a no-op.
 */
@Component
public class HostMetricsCollector {

    private static final Logger log = LoggerFactory.getLogger(HostMetricsCollector.class);

    public static final String SOURCE_HOST = "host";

    private final Path proc;
    private final Path diskPath;
    private final MetricPointRepository points;

    // previous /proc/stat totals — cpu% is a delta between ticks
    private long prevTotal = -1;
    private long prevBusy = -1;

    public HostMetricsCollector(PortalProps props, MetricPointRepository points) {
        this.proc = Path.of(props.host().proc());
        // no host-root mount by design (it would expose every stack's .env);
        // disk stats piggyback on the deploy-state mount, which sits on the root fs
        this.diskPath = Path.of(props.host().diskPath());
        this.points = points;
    }

    @Scheduled(fixedDelayString = "${portal.collect.host-interval-ms:30000}",
            initialDelayString = "${portal.collect.initial-delay-ms:5000}")
    public void collect() {
        Instant ts = Instant.now();
        collectCpu(ts);
        collectMemory(ts);
        collectDisk(ts);
    }

    private void collectCpu(Instant ts) {
        Path stat = proc.resolve("stat");
        if (!Files.isReadable(stat)) {
            return;
        }
        try {
            String cpuLine = Files.readAllLines(stat).stream()
                    .filter(line -> line.startsWith("cpu "))
                    .findFirst().orElse(null);
            if (cpuLine == null) {
                return;
            }
            parseCpuLine(cpuLine).ifPresent(ticks -> {
                long total = ticks[0];
                long busy = ticks[1];
                if (prevTotal >= 0 && total > prevTotal) {
                    double pct = 100.0 * (busy - prevBusy) / (total - prevTotal);
                    points.save(new MetricPoint(ts, SOURCE_HOST, "cpu_pct",
                            Math.clamp(pct, 0.0, 100.0)));
                }
                prevTotal = total;
                prevBusy = busy;
            });
        } catch (Exception e) {
            log.debug("host cpu sample failed: {}", e.toString());
        }
    }

    private void collectMemory(Instant ts) {
        Path meminfo = proc.resolve("meminfo");
        if (!Files.isReadable(meminfo)) {
            return;
        }
        try {
            parseMeminfo(Files.readAllLines(meminfo)).ifPresent(mem -> {
                points.save(new MetricPoint(ts, SOURCE_HOST, "mem_used_bytes", mem[0] - mem[1]));
                points.save(new MetricPoint(ts, SOURCE_HOST, "mem_total_bytes", mem[0]));
            });
        } catch (Exception e) {
            log.debug("host memory sample failed: {}", e.toString());
        }
    }

    private void collectDisk(Instant ts) {
        if (!Files.exists(diskPath)) {
            return;
        }
        try {
            FileStore store = Files.getFileStore(diskPath);
            long total = store.getTotalSpace();
            long usable = store.getUsableSpace();
            points.save(new MetricPoint(ts, SOURCE_HOST, "disk_used_bytes", total - usable));
            points.save(new MetricPoint(ts, SOURCE_HOST, "disk_total_bytes", total));
        } catch (Exception e) {
            log.debug("host disk sample failed: {}", e.toString());
        }
    }

    /**
     * Parses the aggregate "cpu ..." line of /proc/stat into {total, busy} ticks.
     * Fields: user nice system idle iowait irq softirq steal — idle+iowait counts
     * as idle, everything else busy.
     */
    static Optional<long[]> parseCpuLine(String line) {
        String[] parts = line.strip().split("\\s+");
        if (parts.length < 5 || !parts[0].equals("cpu")) {
            return Optional.empty();
        }
        try {
            long total = 0;
            long idle = 0;
            int fields = Math.min(parts.length - 1, 8);
            for (int i = 1; i <= fields; i++) {
                long value = Long.parseLong(parts[i]);
                total += value;
                if (i == 4 || i == 5) { // idle + iowait
                    idle += value;
                }
            }
            return Optional.of(new long[]{total, total - idle});
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    /** {MemTotal, MemAvailable} in bytes from /proc/meminfo (values are kB). */
    static Optional<long[]> parseMeminfo(List<String> lines) {
        Long total = null;
        Long available = null;
        for (String line : lines) {
            if (line.startsWith("MemTotal:")) {
                total = parseKb(line);
            } else if (line.startsWith("MemAvailable:")) {
                available = parseKb(line);
            }
        }
        return total != null && available != null
                ? Optional.of(new long[]{total, available})
                : Optional.empty();
    }

    private static Long parseKb(String line) {
        String[] parts = line.split("\\s+");
        try {
            return parts.length >= 2 ? Long.parseLong(parts[1]) * 1024 : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
