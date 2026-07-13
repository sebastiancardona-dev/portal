package dev.sebastiancardona.portal.collect;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory /info results per app+env, refreshed when the version is unknown or
 * the deploy state changed. Live /info shapes this must accept (verified on prod):
 *
 * 1. flat, static apps — "app" is a STRING (the app name), not an object:
 *    {"app":"swiss-dev-tools","version":"v0.1.0","git_sha":"…","build_time":"…"}
 * 2. Spring Actuator build-info nested (moneytrckr):
 *    {"app":{"version":"v0.4.0","git":{"sha":"…"},"build":{"time":"…"}}}
 * 3. Actuator env contributor via INFO_APP_* (the portal's own /info):
 *    {"app":{"version":"…","git_sha":"…","build_time":"…"}}
 */
@Component
public class InfoCache {

    public record AppInfo(String version, String gitSha, String buildTime) {
    }

    private record Entry(AppInfo info, Instant deployTs) {
    }

    private final Map<String, Entry> cache = new ConcurrentHashMap<>();

    public Optional<AppInfo> get(String app, String env) {
        Entry entry = cache.get(key(app, env));
        return entry == null ? Optional.empty() : Optional.ofNullable(entry.info());
    }

    /** Refresh when never fetched, version still unknown, or deploy state moved on. */
    public boolean needsRefresh(String app, String env, Instant lastDeploy) {
        Entry entry = cache.get(key(app, env));
        if (entry == null || entry.info() == null || entry.info().version() == null) {
            return true;
        }
        return lastDeploy != null && !Objects.equals(lastDeploy, entry.deployTs());
    }

    public void put(String app, String env, AppInfo info, Instant deployTs) {
        cache.put(key(app, env), new Entry(info, deployTs));
    }

    /** Tolerates missing keys: any absent field is null, never an error. */
    public static AppInfo parse(JsonNode root) {
        JsonNode app = root.path("app");
        JsonNode base = app.isObject() ? app : root;
        String version = text(base, "version");
        String gitSha = firstNonNull(
                text(base, "git_sha"),
                text(base.path("git"), "sha"),
                text(base, "gitSha"));
        String buildTime = firstNonNull(
                text(base, "build_time"),
                text(base.path("build"), "time"),
                text(base, "buildTime"));
        return new AppInfo(version, gitSha, buildTime);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isValueNode() && !value.isNull() && !value.asText().isBlank()
                ? value.asText() : null;
    }

    private static String firstNonNull(String... values) {
        for (String value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static String key(String app, String env) {
        return app + ":" + env;
    }
}
