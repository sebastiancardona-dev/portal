package dev.sebastiancardona.portal.data;

import dev.sebastiancardona.portal.discovery.AppCatalog;
import dev.sebastiancardona.portal.discovery.AppCatalog.CatalogApp;
import dev.sebastiancardona.portal.discovery.AppCatalog.EnvView;
import dev.sebastiancardona.portal.metrics.HealthCheckRepository;
import dev.sebastiancardona.portal.metrics.SeriesService;
import dev.sebastiancardona.portal.metrics.SeriesService.Point;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Sources are enumerated dynamically — new apps/containers appear automatically. */
class SourceEnumerationTest {

    private final AppCatalog catalog = mock(AppCatalog.class);
    private final SeriesService series = mock(SeriesService.class);
    private final HealthCheckRepository healthChecks = mock(HealthCheckRepository.class);

    private final SourcesController controller =
            new SourcesController(catalog, series, healthChecks);

    @Test
    void enumeratesAppHostAndContainerSources() {
        when(catalog.apps()).thenReturn(List.of(new CatalogApp("moneytrckr", "MoneyTrckr",
                null, true, null,
                Map.of("prod", new EnvView("prod", "v0.4.0", "success", null, null)),
                List.of())));
        when(series.hostMetrics()).thenReturn(List.of("cpu_pct", "mem_used_bytes"));
        when(series.latestContainerMetrics()).thenReturn(Map.of(
                "portal-db", Map.of("mem_bytes", new Point(Instant.now(), 1.0))));

        var sources = controller.sources();
        var ids = sources.stream().map(s -> s.id()).toList();

        assertThat(ids).containsExactlyInAnyOrder(
                "health:moneytrckr:prod",
                "latency:moneytrckr:prod",
                "host:cpu_pct",
                "host:mem_used_bytes",
                "container:portal-db:mem_bytes");

        var health = sources.stream()
                .filter(s -> s.id().equals("health:moneytrckr:prod")).findFirst().orElseThrow();
        assertThat(health.kind()).isEqualTo("status");
        assertThat(health.app()).isEqualTo("moneytrckr");

        var latency = sources.stream()
                .filter(s -> s.id().equals("latency:moneytrckr:prod")).findFirst().orElseThrow();
        assertThat(latency.kind()).isEqualTo("gauge");
        assertThat(latency.unit()).isEqualTo("ms");

        var hostCpu = sources.stream()
                .filter(s -> s.id().equals("host:cpu_pct")).findFirst().orElseThrow();
        assertThat(hostCpu.unit()).isEqualTo("%");
    }

    @Test
    void noSourcesWhenNothingDiscovered() {
        when(catalog.apps()).thenReturn(List.of());
        when(series.hostMetrics()).thenReturn(List.of());
        when(series.latestContainerMetrics()).thenReturn(Map.of());
        assertThat(controller.sources()).isEmpty();
    }
}
