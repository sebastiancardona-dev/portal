package dev.sebastiancardona.portal.releases;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import java.util.List;

/** Drift: how far prod trails the newest stable release. */
class ReleasesServiceTest {

    private static Release release(String tag, boolean prerelease) {
        Release r = new Release("app", "repo", tag);
        r.setPrerelease(prerelease);
        return r;
    }

    @Test
    void prodOnLatestIsZeroBehind() {
        var timeline = List.of(release("v0.3.0", false), release("v0.2.0", false));
        assertThat(ReleasesService.prodBehind(timeline, "v0.3.0")).isZero();
    }

    @Test
    void prodTwoStableReleasesBack() {
        var timeline = List.of(release("v0.3.0", false), release("v0.2.0", false),
                release("v0.1.0", false));
        assertThat(ReleasesService.prodBehind(timeline, "v0.1.0")).isEqualTo(2);
    }

    @Test
    void prereleasesDoNotCountAsDrift() {
        var timeline = List.of(release("v0.3.0-rc1", true), release("v0.2.0", false),
                release("v0.1.0", false));
        assertThat(ReleasesService.prodBehind(timeline, "v0.2.0")).isZero();
    }

    @Test
    void unknownProdVersionIsNull() {
        var timeline = List.of(release("v0.2.0", false));
        assertThat(ReleasesService.prodBehind(timeline, "test-main-abc123")).isNull();
        assertThat(ReleasesService.prodBehind(timeline, null)).isNull();
    }
}
