package dev.sebastiancardona.portal.data;

import dev.sebastiancardona.portal.collect.InfoCache;
import dev.sebastiancardona.portal.common.ApiExceptions.NotFoundException;
import dev.sebastiancardona.portal.discovery.AppCatalog;
import dev.sebastiancardona.portal.discovery.AppCatalog.CatalogApp;
import dev.sebastiancardona.portal.discovery.AppCatalog.ContainerView;
import dev.sebastiancardona.portal.discovery.AppCatalog.EnvView;
import dev.sebastiancardona.portal.discovery.DeployLogReader;
import dev.sebastiancardona.portal.metrics.HealthCheckRepository;
import dev.sebastiancardona.portal.metrics.SeriesService;
import dev.sebastiancardona.portal.metrics.SeriesService.Point;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Discovered apps with env status, version, deploys, containers — the Apps pages. */
@RestController
@RequestMapping("/api/apps")
public class AppsController {

    private static final int DEPLOY_HISTORY_LIMIT = 50;

    private final AppCatalog catalog;
    private final HealthCheckRepository healthChecks;
    private final SeriesService series;
    private final InfoCache infoCache;
    private final DeployLogReader deployLog;

    public AppsController(AppCatalog catalog, HealthCheckRepository healthChecks,
                          SeriesService series, InfoCache infoCache,
                          DeployLogReader deployLog) {
        this.catalog = catalog;
        this.healthChecks = healthChecks;
        this.series = series;
        this.infoCache = infoCache;
        this.deployLog = deployLog;
    }

    public record EnvDto(String env, String version, String gitSha, String deployStatus,
                         Instant lastDeploy, Boolean up, Long latencyMs, String url) {
    }

    public record ContainerDto(String name, String state, Double cpuPct, Long memBytes) {
    }

    public record AppDto(String app, String displayName, String icon, String url,
                         List<EnvDto> environments, List<ContainerDto> containers) {
    }

    public record UptimeDto(Instant ts, double upPct) {
    }

    public record DeployEventDto(Instant ts, String env, String event) {
    }

    public record AppDetailDto(String app, String displayName, String icon, String url,
                               List<EnvDto> environments, List<ContainerDto> containers,
                               List<UptimeDto> uptime7d, List<DeployEventDto> deployHistory) {
    }

    @GetMapping
    List<AppDto> apps() {
        Map<String, Map<String, Point>> containerStats = series.latestContainerMetrics();
        return catalog.apps().stream()
                .filter(CatalogApp::visible)
                .map(app -> toDto(app, containerStats))
                .toList();
    }

    @GetMapping("/{app}")
    AppDetailDto app(@PathVariable("app") String name) {
        CatalogApp app = catalog.app(name)
                .filter(CatalogApp::visible)
                .orElseThrow(() -> new NotFoundException("unknown app " + name));
        AppDto dto = toDto(app, series.latestContainerMetrics());
        List<UptimeDto> uptime = series.uptime7d(name).stream()
                .map(p -> new UptimeDto(p.ts(), p.value()))
                .toList();
        List<DeployEventDto> history = deployLog.read().stream()
                .filter(event -> event.app().equals(name))
                .map(event -> new DeployEventDto(event.ts(), event.env(), event.event()))
                .toList();
        if (history.size() > DEPLOY_HISTORY_LIMIT) {
            history = history.subList(history.size() - DEPLOY_HISTORY_LIMIT, history.size());
        }
        return new AppDetailDto(dto.app(), dto.displayName(), dto.icon(), dto.url(),
                dto.environments(), dto.containers(), uptime, history);
    }

    private AppDto toDto(CatalogApp app, Map<String, Map<String, Point>> containerStats) {
        List<EnvDto> environments = app.environments().values().stream()
                .map(env -> toEnvDto(app.app(), env))
                .toList();
        List<ContainerDto> containers = app.containers().stream()
                .map(c -> toContainerDto(c, containerStats))
                .toList();
        return new AppDto(app.app(), app.displayName(), app.icon(), appUrl(app),
                environments, containers);
    }

    private EnvDto toEnvDto(String app, EnvView env) {
        var check = healthChecks.findTopByAppAndEnvOrderByTsDesc(app, env.env());
        var info = infoCache.get(app, env.env());
        String version = env.version() != null ? env.version()
                : info.map(InfoCache.AppInfo::version).orElse(null);
        return new EnvDto(env.env(), version,
                info.map(InfoCache.AppInfo::gitSha).orElse(null),
                env.deployStatus(), env.lastDeploy(),
                check.map(c -> (Boolean) c.isUp()).orElse(null),
                check.map(c -> c.getLatencyMs()).orElse(null),
                env.url());
    }

    private static ContainerDto toContainerDto(ContainerView container,
                                               Map<String, Map<String, Point>> stats) {
        Map<String, Point> metrics = stats.getOrDefault(container.name(), Map.of());
        Point cpu = metrics.get("cpu_pct");
        Point mem = metrics.get("mem_bytes");
        return new ContainerDto(container.name(), container.state(),
                cpu == null ? null : cpu.value(),
                mem == null ? null : (long) mem.value());
    }

    /** The app-level URL: prod's if present, else the first env that has one. */
    private static String appUrl(CatalogApp app) {
        EnvView prod = app.environments().get("prod");
        if (prod != null && prod.url() != null) {
            return prod.url();
        }
        return app.environments().values().stream()
                .map(EnvView::url)
                .filter(url -> url != null)
                .findFirst().orElse(null);
    }
}
