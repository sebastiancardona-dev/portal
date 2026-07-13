package dev.sebastiancardona.portal.discovery;

import dev.sebastiancardona.portal.discovery.AppCatalog.CatalogApp;
import dev.sebastiancardona.portal.discovery.DeployLogReader.DeployEvent;
import dev.sebastiancardona.portal.discovery.DockerClient.ContainerSummary;
import dev.sebastiancardona.portal.registry.AppOverride;
import dev.sebastiancardona.portal.registry.AppOverrideRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AppCatalogTest {

    private final DeployStateReader states = mock(DeployStateReader.class);
    private final DeployLogReader deployLog = mock(DeployLogReader.class);
    private final DockerClient docker = mock(DockerClient.class);
    private final AppOverrideRepository overrides = mock(AppOverrideRepository.class);

    private final AppCatalog catalog = new AppCatalog(states, deployLog, docker, overrides);

    @BeforeEach
    void emptyByDefault() {
        when(states.read()).thenReturn(List.of());
        when(deployLog.read()).thenReturn(List.of());
        when(docker.listContainers()).thenReturn(List.of());
        when(overrides.findAll()).thenReturn(List.of());
    }

    @Test
    void stateOnlyAppExists() {
        Instant deployed = Instant.parse("2026-07-12T19:40:55Z");
        when(states.read()).thenReturn(List.of(
                new DeployState("moneytrckr", "prod", "v0.4.0", "success", deployed)));

        List<CatalogApp> apps = catalog.apps();

        assertThat(apps).hasSize(1);
        CatalogApp app = apps.getFirst();
        assertThat(app.app()).isEqualTo("moneytrckr");
        assertThat(app.displayName()).isEqualTo("moneytrckr"); // no override → raw name
        assertThat(app.visible()).isTrue();
        assertThat(app.containers()).isEmpty();
        var env = app.environments().get("prod");
        assertThat(env.version()).isEqualTo("v0.4.0");
        assertThat(env.deployStatus()).isEqualTo("success");
        assertThat(env.lastDeploy()).isEqualTo(deployed);
        assertThat(env.url()).isNull();
    }

    @Test
    void dockerOnlyAppExistsWithUrlFromTraefikRule() {
        when(docker.listContainers()).thenReturn(List.of(
                new ContainerSummary("abc123", "hello-ecosystem", "running", Map.of(
                        "com.docker.compose.project", "hello-ecosystem",
                        "com.docker.compose.service", "hello-ecosystem",
                        "traefik.http.routers.hello.rule",
                        "Host(`hello.sebastiancardona.dev`)"))));

        List<CatalogApp> apps = catalog.apps();

        assertThat(apps).hasSize(1);
        CatalogApp app = apps.getFirst();
        assertThat(app.app()).isEqualTo("hello-ecosystem");
        assertThat(app.environments().get("prod").url())
                .isEqualTo("https://hello.sebastiancardona.dev");
        assertThat(app.containers()).hasSize(1);
        assertThat(app.containers().getFirst().name()).isEqualTo("hello-ecosystem");
    }

    @Test
    void testStackContainersMapByServiceLabelAndDbSidecarsAttach() {
        when(docker.listContainers()).thenReturn(List.of(
                new ContainerSummary("id1", "apps-test-moneytrckr-1", "running", Map.of(
                        "com.docker.compose.project", "apps-test",
                        "com.docker.compose.service", "moneytrckr")),
                new ContainerSummary("id2", "apps-test-moneytrckr-db-1", "running", Map.of(
                        "com.docker.compose.project", "apps-test",
                        "com.docker.compose.service", "moneytrckr-db"))));

        List<CatalogApp> apps = catalog.apps();

        assertThat(apps).hasSize(1);
        CatalogApp app = apps.getFirst();
        assertThat(app.app()).isEqualTo("moneytrckr");
        assertThat(app.environments()).containsOnlyKeys("test");
        assertThat(app.containers()).hasSize(2);
    }

    @Test
    void nonComposeContainersAreIgnored() {
        when(docker.listContainers()).thenReturn(List.of(
                new ContainerSummary("id", "random", "running", Map.of())));
        assertThat(catalog.apps()).isEmpty();
    }

    @Test
    void mergesSourcesForTheSameApp() {
        when(states.read()).thenReturn(List.of(
                new DeployState("moneytrckr", "prod", "v0.4.0", "success", null)));
        when(deployLog.read()).thenReturn(List.of(
                new DeployEvent(Instant.parse("2026-07-10T10:00:00Z"), "moneytrckr", "test",
                        "healthy")));
        when(docker.listContainers()).thenReturn(List.of(
                new ContainerSummary("id", "moneytrckr", "running", Map.of(
                        "com.docker.compose.project", "moneytrckr",
                        "com.docker.compose.service", "moneytrckr",
                        "traefik.http.routers.moneytrckr.rule",
                        "Host(`moneytrckr.sebastiancardona.dev`)"))));

        List<CatalogApp> apps = catalog.apps();

        assertThat(apps).hasSize(1);
        CatalogApp app = apps.getFirst();
        assertThat(app.environments()).containsOnlyKeys("prod", "test");
        assertThat(app.environments().get("prod").version()).isEqualTo("v0.4.0");
        assertThat(app.environments().get("prod").url())
                .isEqualTo("https://moneytrckr.sebastiancardona.dev");
    }

    @Test
    void overridesApplyDisplayMetadataButNeverCreateApps() {
        when(states.read()).thenReturn(List.of(
                new DeployState("moneytrckr", "prod", "v0.4.0", "success", null)));
        AppOverride override = new AppOverride("moneytrckr");
        override.setDisplayName("MoneyTrckr");
        override.setIcon("wallet");
        override.setVisible(false);
        override.setHealthPath("/healthz");
        AppOverride orphan = new AppOverride("no-such-app");
        when(overrides.findAll()).thenReturn(List.of(override, orphan));

        List<CatalogApp> apps = catalog.apps();

        assertThat(apps).hasSize(1); // the orphan override created nothing
        CatalogApp app = apps.getFirst();
        assertThat(app.displayName()).isEqualTo("MoneyTrckr");
        assertThat(app.icon()).isEqualTo("wallet");
        assertThat(app.visible()).isFalse();
        assertThat(app.healthPath()).isEqualTo("/healthz");
    }

    @Test
    void extractsMultipleHostsFromRuleLabels() {
        List<String> hosts = AppCatalog.extractHosts(Map.of(
                "traefik.http.routers.web.rule",
                "Host(`a.example.dev`) || Host(`b.example.dev`)",
                "traefik.enable", "true"));
        assertThat(hosts).containsExactlyInAnyOrder("a.example.dev", "b.example.dev");
    }
}
