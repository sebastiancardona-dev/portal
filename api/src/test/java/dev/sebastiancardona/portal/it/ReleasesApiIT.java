package dev.sebastiancardona.portal.it;

import static org.assertj.core.api.Assertions.assertThat;

import dev.sebastiancardona.portal.releases.Release;
import dev.sebastiancardona.portal.releases.ReleaseRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * The releases module API (/api/releases/**): viewer-visible (release metadata
 * has no PII — deliberate contrast with /api/logs), honest "not connected"
 * answer when no GitHub token is configured, and cache-backed reads.
 */
class ReleasesApiIT extends AbstractIT {

    @Autowired
    ReleaseRepository releases;

    @AfterEach
    void cleanUp() {
        releases.deleteAll();
    }

    @Test
    void viewerIsWelcome() {
        assertThat(get("/api/releases", recruiterToken()).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(get("/api/releases/portal", recruiterToken()).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test
    void anonymousIsNot() {
        assertThat(get("/api/releases", null).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unconfiguredAndEmptySaysNotAvailable() {
        var response = get("/api/releases", adminToken());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("available")).isEqualTo(false);
        assertThat((List<?>) response.getBody().get("releases")).isEmpty();
    }

    @Test
    @SuppressWarnings("unchecked")
    void cachedReleasesServeNewestFirstWithArtifactRefs() {
        seed("portal", "portal", "v0.1.0", "2026-07-18T18:39:57Z");
        seed("portal", "portal", "v0.2.0", "2026-07-18T20:39:41Z");
        seed("auth", "auth-service", "v0.3.1", "2026-07-19T00:27:59Z");

        var feed = get("/api/releases", recruiterToken());
        assertThat(feed.getBody().get("available")).isEqualTo(true); // cache trumps no-token
        var rows = (List<Map<String, Object>>) feed.getBody().get("releases");
        assertThat(rows).extracting(r -> r.get("tag"))
                .containsExactly("v0.3.1", "v0.2.0", "v0.1.0");
        // image ref uses the APP name (pipeline identity), not the repo name
        assertThat(rows.getFirst().get("imageRef"))
                .isEqualTo("ghcr.io/sebastiancardona-dev/auth:v0.3.1");

        var timeline = get("/api/releases/portal", recruiterToken());
        var portalRows = (List<Map<String, Object>>) timeline.getBody().get("releases");
        assertThat(portalRows).hasSize(2);
        assertThat(portalRows.getFirst().get("compareUrl"))
                .isEqualTo("https://github.com/sebastiancardona-dev/portal/compare/v0.1.0...v0.2.0");
        assertThat(portalRows.getLast().get("compareUrl")).isNull(); // first release: nothing before it
        // no deploy-state files in this environment — markers stay honest
        assertThat(portalRows.getFirst().get("deployedProd")).isEqualTo(false);
        assertThat(timeline.getBody().get("prodVersion")).isNull();
        assertThat(timeline.getBody().get("prodBehind")).isNull();
    }

    private void seed(String app, String repo, String tag, String publishedAt) {
        Release release = new Release(app, repo, tag);
        release.setName(tag);
        release.setPublishedAt(Instant.parse(publishedAt));
        release.setSyncedAt(Instant.now());
        releases.save(release);
    }
}
