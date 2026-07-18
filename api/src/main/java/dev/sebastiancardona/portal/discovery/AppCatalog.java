package dev.sebastiancardona.portal.discovery;

import dev.sebastiancardona.portal.discovery.DeployLogReader.DeployEvent;
import dev.sebastiancardona.portal.discovery.DockerClient.ContainerSummary;
import dev.sebastiancardona.portal.registry.AppOverride;
import dev.sebastiancardona.portal.registry.AppOverrideRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Universality lives here: apps are merged from deploy state + deploy log + Docker
 * labels, keyed by the pipeline's identity triple (app name = image = stack dir).
 * An app present in ANY source exists; overrides are display metadata only and
 * never create or gate discovery. Every source is optional and failure-tolerant.
 */
@Component
public class AppCatalog {

    private static final Pattern ROUTER_RULE_LABEL =
            Pattern.compile("^traefik\\.http\\.routers\\.[^.]+\\.rule$");
    private static final Pattern HOST_RULE = Pattern.compile("Host\\(\\s*`([^`]+)`");
    private static final String TEST_STACK_PROJECT = "apps-test";

    private final DeployStateReader states;
    private final DeployLogReader deployLog;
    private final DockerClient docker;
    private final AppOverrideRepository overrides;

    public AppCatalog(DeployStateReader states, DeployLogReader deployLog,
                      DockerClient docker, AppOverrideRepository overrides) {
        this.states = states;
        this.deployLog = deployLog;
        this.docker = docker;
        this.overrides = overrides;
    }

    public record EnvView(String env, String version, String deployStatus,
                          Instant lastDeploy, String url) {
    }

    public record ContainerView(String id, String name, String state) {
    }

    public record CatalogApp(String app, String displayName, String icon, boolean visible,
                             String healthPath, Map<String, EnvView> environments,
                             List<ContainerView> containers) {
    }

    public List<CatalogApp> apps() {
        Map<String, MutableApp> byApp = new TreeMap<>();

        // 1) deploy state — known apps + env, current version, last deploy, status
        for (DeployState state : states.read()) {
            MutableEnv env = byApp.computeIfAbsent(state.app(), MutableApp::new)
                    .env(state.env());
            env.version = state.version();
            env.deployStatus = state.status();
            env.lastDeploy = state.timestamp();
        }

        // 2) deploy log — an app/env only ever seen in history still exists
        for (DeployEvent event : deployLog.read()) {
            byApp.computeIfAbsent(event.app(), MutableApp::new).env(event.env());
        }

        // 3) docker runtime — containers, running state, public URLs (Traefik rules)
        for (ContainerSummary container : docker.listContainers()) {
            AppEnvRef ref = mapContainer(container.labels());
            if (ref == null) {
                continue;
            }
            MutableApp app = byApp.computeIfAbsent(ref.app(), MutableApp::new);
            app.containers.add(new ContainerView(container.id(), container.name(),
                    container.state()));
            MutableEnv env = app.env(ref.env());
            List<String> hosts = extractHosts(container.labels());
            if (env.url == null && !hosts.isEmpty()) {
                env.url = "https://" + hosts.getFirst();
            }
        }

        // 4) overrides — optional display metadata; applied only to discovered apps
        for (AppOverride override : overrides.findAll()) {
            MutableApp app = byApp.get(override.getApp());
            if (app != null) {
                app.override = override;
            }
        }

        return byApp.values().stream().map(MutableApp::build).toList();
    }

    public Optional<CatalogApp> app(String name) {
        return apps().stream().filter(a -> a.app().equals(name)).findFirst();
    }

    public record AppEnvRef(String app, String env) {
    }

    /**
     * Container ↔ app mapping via compose labels: prod stacks are named after the
     * app (project == app); the shared test stack is `apps-test` where the service
     * label is the app. `<app>-db` sidecars attach to their app.
     */
    public static AppEnvRef mapContainer(Map<String, String> labels) {
        String project = labels.getOrDefault("com.docker.compose.project", "").strip();
        if (project.isEmpty()) {
            return null; // not a compose-managed container — not one of ours
        }
        if (TEST_STACK_PROJECT.equals(project)) {
            String service = labels.getOrDefault("com.docker.compose.service", "").strip();
            String app = stripDbSuffix(service);
            return app.isEmpty() ? null : new AppEnvRef(app, "test");
        }
        return new AppEnvRef(project, "prod");
    }

    private static String stripDbSuffix(String service) {
        return service.endsWith("-db")
                ? service.substring(0, service.length() - "-db".length())
                : service;
    }

    /**
     * URL by ecosystem convention (project 03): prod lives at the base host,
     * every other env inserts `-<env>` after the first label
     * (tools.example.dev + test → tools-test.example.dev).
     */
    public static String deriveUrl(String baseHost, String env) {
        if ("prod".equals(env)) {
            return "https://" + baseHost;
        }
        int dot = baseHost.indexOf('.');
        // a real subdomain has ≥2 dots (tools.example.dev); an apex (example.dev)
        // has no test-host convention to lean on
        if (dot <= 0 || baseHost.indexOf('.', dot + 1) < 0) {
            return null;
        }
        return "https://" + baseHost.substring(0, dot) + "-" + env + baseHost.substring(dot);
    }

    /** Host(`...`) values from any traefik router rule label. */
    public static List<String> extractHosts(Map<String, String> labels) {
        List<String> hosts = new ArrayList<>();
        labels.forEach((key, value) -> {
            if (ROUTER_RULE_LABEL.matcher(key).matches()) {
                Matcher m = HOST_RULE.matcher(value);
                while (m.find()) {
                    hosts.add(m.group(1));
                }
            }
        });
        return hosts;
    }

    private static final class MutableApp {
        final String app;
        final Map<String, MutableEnv> environments = new TreeMap<>();
        final List<ContainerView> containers = new ArrayList<>();
        AppOverride override;

        MutableApp(String app) {
            this.app = app;
        }

        MutableEnv env(String name) {
            return environments.computeIfAbsent(name, MutableEnv::new);
        }

        CatalogApp build() {
            Map<String, EnvView> envs = new LinkedHashMap<>();
            environments.forEach((name, env) -> {
                // baseHost fallback: an env without a Docker-discovered URL (the
                // test slot has no Docker sources) still gets a probeable URL
                if (env.url == null && override != null && override.getBaseHost() != null) {
                    env.url = deriveUrl(override.getBaseHost(), name);
                }
                envs.put(name, env.build());
            });
            String displayName = override != null && override.getDisplayName() != null
                    ? override.getDisplayName() : app;
            return new CatalogApp(app, displayName,
                    override != null ? override.getIcon() : null,
                    override == null || override.isVisible(),
                    override != null ? override.getHealthPath() : null,
                    envs, List.copyOf(containers));
        }
    }

    private static final class MutableEnv {
        final String env;
        String version;
        String deployStatus;
        Instant lastDeploy;
        String url;

        MutableEnv(String env) {
            this.env = env;
        }

        EnvView build() {
            return new EnvView(env, version, deployStatus, lastDeploy, url);
        }
    }
}
