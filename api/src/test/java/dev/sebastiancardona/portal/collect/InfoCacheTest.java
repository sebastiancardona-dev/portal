package dev.sebastiancardona.portal.collect;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sebastiancardona.portal.collect.InfoCache.AppInfo;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The three /info shapes verified LIVE on production (do not invent formats —
 * these are copied from the real responses).
 */
class InfoCacheTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void parsesFlatShapeWhereAppIsTheAppNameString() throws Exception {
        // static apps (swiss-dev-tools / hello-ecosystem / portfolio)
        AppInfo info = InfoCache.parse(MAPPER.readTree("""
                {"app":"swiss-dev-tools","version":"v0.1.0",\
                "git_sha":"d484b14aa8e7f2f4f4a9c0d3b1e5c6a7d8e9f0a1",\
                "build_time":"2026-07-11T16:58:04-06:00"}"""));
        assertThat(info.version()).isEqualTo("v0.1.0");
        assertThat(info.gitSha()).startsWith("d484b14");
        assertThat(info.buildTime()).isEqualTo("2026-07-11T16:58:04-06:00");
    }

    @Test
    void parsesActuatorNestedShapeWithGitShaAndBuildTime() throws Exception {
        // moneytrckr: app.git.sha and app.build.time — NOT app.git_sha
        AppInfo info = InfoCache.parse(MAPPER.readTree("""
                {"app":{"version":"v0.4.0",\
                "git":{"sha":"7c5010e1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7"},\
                "build":{"time":"2026-07-12T13:33:01-06:00"}}}"""));
        assertThat(info.version()).isEqualTo("v0.4.0");
        assertThat(info.gitSha()).startsWith("7c5010e");
        assertThat(info.buildTime()).isEqualTo("2026-07-12T13:33:01-06:00");
    }

    @Test
    void parsesActuatorEnvContributorShape() throws Exception {
        // the portal's own /info via INFO_APP_* env vars
        AppInfo info = InfoCache.parse(MAPPER.readTree("""
                {"app":{"version":"v0.1.0","git_sha":"695ddbf",\
                "build_time":"2026-07-12T19:40:55Z"}}"""));
        assertThat(info.version()).isEqualTo("v0.1.0");
        assertThat(info.gitSha()).isEqualTo("695ddbf");
        assertThat(info.buildTime()).isEqualTo("2026-07-12T19:40:55Z");
    }

    @Test
    void toleratesMissingKeysAndUnknownShapes() throws Exception {
        AppInfo empty = InfoCache.parse(MAPPER.readTree("{}"));
        assertThat(empty.version()).isNull();
        assertThat(empty.gitSha()).isNull();
        assertThat(empty.buildTime()).isNull();

        AppInfo partial = InfoCache.parse(MAPPER.readTree("{\"version\":\"v9\"}"));
        assertThat(partial.version()).isEqualTo("v9");
        assertThat(partial.gitSha()).isNull();
    }

    @Test
    void refreshesWhenUnknownOrDeployStateChanged() {
        InfoCache cache = new InfoCache();
        Instant deploy1 = Instant.parse("2026-07-12T19:40:55Z");
        Instant deploy2 = Instant.parse("2026-07-13T08:00:00Z");

        assertThat(cache.needsRefresh("moneytrckr", "prod", deploy1)).isTrue();

        cache.put("moneytrckr", "prod", new AppInfo("v0.4.0", "7c5010e", null), deploy1);
        assertThat(cache.needsRefresh("moneytrckr", "prod", deploy1)).isFalse();
        assertThat(cache.needsRefresh("moneytrckr", "prod", deploy2)).isTrue();

        // version still unknown → keep trying
        cache.put("moneytrckr", "test", new AppInfo(null, null, null), deploy1);
        assertThat(cache.needsRefresh("moneytrckr", "test", deploy1)).isTrue();
    }
}
