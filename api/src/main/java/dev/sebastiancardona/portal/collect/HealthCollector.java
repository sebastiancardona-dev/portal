package dev.sebastiancardona.portal.collect;

import com.fasterxml.jackson.databind.JsonNode;
import dev.sebastiancardona.portal.discovery.AppCatalog;
import dev.sebastiancardona.portal.discovery.AppCatalog.CatalogApp;
import dev.sebastiancardona.portal.discovery.AppCatalog.EnvView;
import dev.sebastiancardona.portal.metrics.HealthCheck;
import dev.sebastiancardona.portal.metrics.HealthCheckRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;

/**
 * Probes GET <url>/health for every discovered app+env that has a public URL
 * (3s timeout) and records the result. Fetches /info when the version is unknown
 * or the deploy state changed, caching the parsed answer in memory.
 */
@Component
public class HealthCollector {

    private static final Logger log = LoggerFactory.getLogger(HealthCollector.class);

    private final AppCatalog catalog;
    private final HealthCheckRepository checks;
    private final InfoCache infoCache;
    private final RestClient http;

    public HealthCollector(AppCatalog catalog, HealthCheckRepository checks,
                           InfoCache infoCache) {
        this.catalog = catalog;
        this.checks = checks;
        this.infoCache = infoCache;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(3));
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    @Scheduled(fixedDelayString = "${portal.collect.health-interval-ms:30000}",
            initialDelayString = "${portal.collect.initial-delay-ms:5000}")
    public void collect() {
        for (CatalogApp app : catalog.apps()) {
            for (EnvView env : app.environments().values()) {
                if (env.url() == null) {
                    continue;
                }
                try {
                    probe(app, env);
                } catch (Exception e) {
                    log.debug("health probe failed for {}/{}: {}", app.app(), env.env(),
                            e.toString());
                }
            }
        }
    }

    private void probe(CatalogApp app, EnvView env) {
        String healthPath = app.healthPath() == null || app.healthPath().isBlank()
                ? "/health" : app.healthPath();
        Instant now = Instant.now();
        long started = System.nanoTime();
        boolean up = false;
        Integer status = null;
        Long latencyMs = null;
        try {
            status = http.get().uri(env.url() + healthPath)
                    .exchange((request, response) -> response.getStatusCode().value());
            latencyMs = (System.nanoTime() - started) / 1_000_000;
            up = status >= 200 && status < 300;
        } catch (Exception e) {
            log.debug("health check {}{} unreachable: {}", env.url(), healthPath, e.toString());
        }
        checks.save(new HealthCheck(now, app.app(), env.env(), up, status, latencyMs));

        if (up && infoCache.needsRefresh(app.app(), env.env(), env.lastDeploy())) {
            fetchInfo(app.app(), env);
        }
    }

    private void fetchInfo(String app, EnvView env) {
        try {
            JsonNode info = http.get().uri(env.url() + "/info").retrieve().body(JsonNode.class);
            if (info != null) {
                infoCache.put(app, env.env(), InfoCache.parse(info), env.lastDeploy());
            }
        } catch (Exception e) {
            log.debug("info fetch failed for {}/{}: {}", app, env.env(), e.toString());
        }
    }
}
