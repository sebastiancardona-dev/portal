package dev.sebastiancardona.portal.discovery;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class DockerClientTest {

    @Test
    void cpuPctUsesTheDockerStatsDeltaFormula() {
        // (cpu_delta / system_delta) * online_cpus * 100
        double pct = DockerClient.computeCpuPct(
                400_000_000L, 300_000_000L,     // cpu total: Δ = 100ms of cpu time
                10_000_000_000L, 8_000_000_000L, // system: Δ = 2s across all cpus
                2);
        assertThat(pct).isCloseTo(10.0, within(0.0001));
    }

    @Test
    void cpuPctIsZeroWhenDeltasAreMissingOrNegative() {
        assertThat(DockerClient.computeCpuPct(100, 100, 200, 100, 2)).isZero();
        assertThat(DockerClient.computeCpuPct(50, 100, 200, 100, 2)).isZero();
        assertThat(DockerClient.computeCpuPct(200, 100, 100, 100, 2)).isZero();
        assertThat(DockerClient.computeCpuPct(200, 100, 200, 100, 0)).isZero();
    }

    @Test
    void parsesStatsJsonUsingPrecpuStats() throws Exception {
        var stats = new ObjectMapper().readTree("""
                {
                  "cpu_stats": {
                    "cpu_usage": {"total_usage": 400000000},
                    "system_cpu_usage": 10000000000,
                    "online_cpus": 2
                  },
                  "precpu_stats": {
                    "cpu_usage": {"total_usage": 300000000},
                    "system_cpu_usage": 8000000000
                  },
                  "memory_stats": {"usage": 52428800}
                }""");
        var parsed = DockerClient.parseStats(stats);
        assertThat(parsed.cpuPct()).isCloseTo(10.0, within(0.0001));
        assertThat(parsed.memBytes()).isEqualTo(52_428_800L);
    }

    @Test
    void fallsBackToPercpuUsageLengthWhenOnlineCpusMissing() throws Exception {
        var stats = new ObjectMapper().readTree("""
                {
                  "cpu_stats": {
                    "cpu_usage": {"total_usage": 400000000,
                                  "percpu_usage": [1, 2]},
                    "system_cpu_usage": 10000000000
                  },
                  "precpu_stats": {
                    "cpu_usage": {"total_usage": 300000000},
                    "system_cpu_usage": 8000000000
                  },
                  "memory_stats": {"usage": 1024}
                }""");
        assertThat(DockerClient.parseStats(stats).cpuPct()).isCloseTo(10.0, within(0.0001));
    }
}
