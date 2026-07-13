package dev.sebastiancardona.portal.collect;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class HostMetricsParsingTest {

    @Test
    void parsesProcStatCpuLine() {
        // user nice system idle iowait irq softirq steal
        long[] ticks = HostMetricsCollector
                .parseCpuLine("cpu  100 0 50 800 50 0 0 0 0 0").orElseThrow();
        assertThat(ticks[0]).isEqualTo(1000); // total
        assertThat(ticks[1]).isEqualTo(150);  // busy = total - (idle + iowait)
    }

    @Test
    void rejectsNonCpuOrGarbageLines() {
        assertThat(HostMetricsCollector.parseCpuLine("cpu0 1 2 3 4 5 6 7 8")).isEmpty();
        assertThat(HostMetricsCollector.parseCpuLine("intr 12345")).isEmpty();
        assertThat(HostMetricsCollector.parseCpuLine("cpu a b c d e")).isEmpty();
    }

    @Test
    void parsesMeminfoToBytes() {
        long[] mem = HostMetricsCollector.parseMeminfo(List.of(
                "MemTotal:        4030668 kB",
                "MemFree:          123456 kB",
                "MemAvailable:    2015334 kB")).orElseThrow();
        assertThat(mem[0]).isEqualTo(4030668L * 1024);
        assertThat(mem[1]).isEqualTo(2015334L * 1024);
    }

    @Test
    void meminfoWithoutAvailableIsSkipped() {
        assertThat(HostMetricsCollector.parseMeminfo(List.of("MemTotal: 100 kB"))).isEmpty();
    }
}
