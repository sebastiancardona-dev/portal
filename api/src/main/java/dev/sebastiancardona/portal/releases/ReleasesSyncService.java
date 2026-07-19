package dev.sebastiancardona.portal.releases;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import dev.sebastiancardona.portal.discovery.AppCatalog;
import dev.sebastiancardona.portal.discovery.AppCatalog.CatalogApp;
import dev.sebastiancardona.portal.registry.AppOverride;
import dev.sebastiancardona.portal.registry.AppOverrideRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Pulls GitHub releases for every visible discovered app into Postgres on a
 * schedule. Repo name defaults to the app name; app_overrides.repo covers the
 * two that differ. Per-repo failures are logged and skipped — one renamed repo
 * must not stall the ecosystem feed (HealthCollector's tolerance model).
 */
@Component
public class ReleasesSyncService {

    private static final Logger log = LoggerFactory.getLogger(ReleasesSyncService.class);

    private final GitHubClient github;
    private final AppCatalog catalog;
    private final AppOverrideRepository overrides;
    private final ReleaseRepository releases;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, String> etags = new ConcurrentHashMap<>();
    private final AtomicReference<Instant> lastSync = new AtomicReference<>();

    public ReleasesSyncService(GitHubClient github, AppCatalog catalog,
                               AppOverrideRepository overrides, ReleaseRepository releases) {
        this.github = github;
        this.catalog = catalog;
        this.overrides = overrides;
        this.releases = releases;
    }

    public Optional<Instant> lastSyncAt() {
        return Optional.ofNullable(lastSync.get());
    }

    @Scheduled(fixedDelayString = "${portal.github.sync-interval-ms:600000}",
            initialDelayString = "${portal.collect.initial-delay-ms:5000}")
    public void sync() {
        if (!github.configured()) {
            return;
        }
        Map<String, String> repoByApp = repoMapping();
        for (Map.Entry<String, String> entry : repoByApp.entrySet()) {
            try {
                syncRepo(entry.getKey(), entry.getValue());
            } catch (Exception e) {
                log.warn("release sync failed for {} ({}): {}", entry.getKey(),
                        entry.getValue(), e.toString());
            }
        }
        lastSync.set(Instant.now());
    }

    /** app -> repo for every visible discovered app (override wins, else app name). */
    Map<String, String> repoMapping() {
        Map<String, String> repoOverrides = new HashMap<>();
        for (AppOverride override : overrides.findAll()) {
            if (override.getRepo() != null) {
                repoOverrides.put(override.getApp(), override.getRepo());
            }
        }
        Map<String, String> mapping = new LinkedHashMap<>();
        for (CatalogApp app : catalog.apps()) {
            if (app.visible()) {
                mapping.put(app.app(), repoOverrides.getOrDefault(app.app(), app.app()));
            }
        }
        return mapping;
    }

    /**
     * Deliberately NOT one big transaction (and @Transactional wouldn't apply on
     * self-invocation anyway): each save/delete commits on its own, and a partial
     * sync heals on the next run because the upsert is idempotent by (repo, tag).
     */
    void syncRepo(String app, String repo) {
        GitHubClient.ReleasesPage page = github.listReleases(repo, etags.get(repo));
        if (page.body() == null) {
            return; // 304 — cache is current
        }
        Instant now = Instant.now();
        Map<String, Release> existing = new HashMap<>();
        for (Release release : releases.findByRepo(repo)) {
            existing.put(release.getTag(), release);
        }
        for (JsonNode json : page.body()) {
            Optional<Parsed> parsed = parse(json);
            if (parsed.isEmpty()) {
                continue;
            }
            Parsed p = parsed.get();
            Release release = existing.remove(p.tag());
            if (release == null) {
                release = new Release(app, repo, p.tag());
            }
            release.setApp(app); // re-stamped: a repo remap heals next sync
            release.setName(p.name());
            release.setBody(p.body());
            release.setPrerelease(p.prerelease());
            release.setHtmlUrl(p.htmlUrl());
            release.setPublishedAt(p.publishedAt());
            release.setAssets(assetsJson(json));
            release.setSyncedAt(now);
            releases.save(release);
        }
        // whatever GitHub no longer lists (deleted release/tag) leaves the cache too
        releases.deleteAll(existing.values());
        if (page.etag() != null) {
            etags.put(repo, page.etag());
        }
        log.debug("release sync {} ({}): {} releases", app, repo, page.body().size());
    }

    record Parsed(String tag, String name, String body, boolean prerelease,
                  String htmlUrl, Instant publishedAt) {
    }

    /** Drafts have no tag yet and aren't shipped — skipped. */
    static Optional<Parsed> parse(JsonNode json) {
        String tag = json.path("tag_name").asText("");
        if (tag.isBlank() || json.path("draft").asBoolean(false)) {
            return Optional.empty();
        }
        return Optional.of(new Parsed(tag,
                textOrNull(json, "name"),
                textOrNull(json, "body"),
                json.path("prerelease").asBoolean(false),
                textOrNull(json, "html_url"),
                parseTimestamp(json.path("published_at").asText(null))));
    }

    /** GitHub's asset objects pared down to what the artifact panel shows. */
    private String assetsJson(JsonNode json) {
        JsonNode assets = json.path("assets");
        if (!assets.isArray() || assets.isEmpty()) {
            return null;
        }
        ArrayNode pared = mapper.createArrayNode();
        for (JsonNode asset : assets) {
            pared.addObject()
                    .put("name", asset.path("name").asText(""))
                    .put("size", asset.path("size").asLong(0))
                    .put("downloadUrl", asset.path("browser_download_url").asText(""));
        }
        return pared.toString();
    }

    private static String textOrNull(JsonNode json, String field) {
        JsonNode value = json.path(field);
        return value.isTextual() && !value.asText().isBlank() ? value.asText() : null;
    }

    private static Instant parseTimestamp(String value) {
        if (value == null) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (Exception e) {
            return null;
        }
    }
}
