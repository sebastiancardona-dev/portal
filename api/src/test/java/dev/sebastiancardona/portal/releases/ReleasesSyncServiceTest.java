package dev.sebastiancardona.portal.releases;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;

/** GitHub payload → cache row mapping, incl. the honest skips. */
class ReleasesSyncServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static JsonNode json(String content) throws Exception {
        return MAPPER.readTree(content);
    }

    @Test
    void mapsTheFieldsTheModuleShows() throws Exception {
        var parsed = ReleasesSyncService.parse(json("""
                {"tag_name":"v0.3.0","name":"v0.3.0","body":"## What's Changed\\n- logs module",
                 "draft":false,"prerelease":false,
                 "html_url":"https://github.com/o/r/releases/tag/v0.3.0",
                 "published_at":"2026-07-19T03:15:00Z"}
                """));
        assertThat(parsed).isPresent();
        var p = parsed.get();
        assertThat(p.tag()).isEqualTo("v0.3.0");
        assertThat(p.name()).isEqualTo("v0.3.0");
        assertThat(p.body()).contains("logs module");
        assertThat(p.prerelease()).isFalse();
        assertThat(p.htmlUrl()).endsWith("/tag/v0.3.0");
        assertThat(p.publishedAt()).isEqualTo(Instant.parse("2026-07-19T03:15:00Z"));
    }

    @Test
    void draftsAreSkipped() throws Exception {
        assertThat(ReleasesSyncService.parse(json(
                "{\"tag_name\":\"v9.9.9\",\"draft\":true}"))).isEmpty();
    }

    @Test
    void missingTagIsSkipped() throws Exception {
        assertThat(ReleasesSyncService.parse(json("{\"name\":\"nameless\"}"))).isEmpty();
    }

    @Test
    void unpublishedTimestampAndBlanksBecomeNulls() throws Exception {
        var parsed = ReleasesSyncService.parse(json(
                "{\"tag_name\":\"v0.1.0\",\"name\":\"\",\"body\":null,\"published_at\":null}"));
        assertThat(parsed).isPresent();
        assertThat(parsed.get().name()).isNull();
        assertThat(parsed.get().body()).isNull();
        assertThat(parsed.get().publishedAt()).isNull();
    }
}
