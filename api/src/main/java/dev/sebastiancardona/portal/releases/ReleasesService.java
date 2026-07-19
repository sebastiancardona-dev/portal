package dev.sebastiancardona.portal.releases;

import dev.sebastiancardona.portal.discovery.DeployState;
import dev.sebastiancardona.portal.discovery.DeployStateReader;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Serves the cached release timeline joined with pipeline deploy state: which
 * tag runs on prod/test right now, and how far prod trails the latest release.
 * Reads only the Postgres cache — GitHub is never called on a request path.
 */
@Service
public class ReleasesService {

    private final ReleaseRepository releases;
    private final DeployStateReader deployStates;
    private final GitHubClient github;
    private final ReleasesSyncService sync;

    public ReleasesService(ReleaseRepository releases, DeployStateReader deployStates,
                           GitHubClient github, ReleasesSyncService sync) {
        this.releases = releases;
        this.deployStates = deployStates;
        this.github = github;
        this.sync = sync;
    }

    public record ReleaseDto(String app, String repo, String tag, String name, String body,
                             boolean prerelease, String htmlUrl, Instant publishedAt,
                             boolean deployedProd, boolean deployedTest,
                             String imageRef, String compareUrl, String assets) {
    }

    public record FeedDto(boolean available, Instant lastSyncAt, List<ReleaseDto> releases) {
    }

    public record AppReleasesDto(boolean available, Instant lastSyncAt, String app,
                                 String prodVersion, String testVersion, Integer prodBehind,
                                 List<ReleaseDto> releases) {
    }

    public FeedDto feed(int limit) {
        Map<String, Map<String, String>> deployed = deployedVersions();
        List<ReleaseDto> recent = releases.recent(Limit.of(limit)).stream()
                .map(release -> toDto(release, deployed, null))
                .toList();
        return new FeedDto(available(), sync.lastSyncAt().orElse(null), recent);
    }

    public AppReleasesDto forApp(String app) {
        Map<String, Map<String, String>> deployed = deployedVersions();
        List<Release> timeline = releases.timelineForApp(app);
        Map<String, String> previousTag = previousTags(timeline);
        List<ReleaseDto> dtos = timeline.stream()
                .map(release -> toDto(release, deployed, previousTag.get(release.getTag())))
                .toList();
        String prod = deployed.getOrDefault(app, Map.of()).get("prod");
        String test = deployed.getOrDefault(app, Map.of()).get("test");
        return new AppReleasesDto(available(), sync.lastSyncAt().orElse(null), app,
                prod, test, prodBehind(timeline, prod), dtos);
    }

    /** Cache present but token gone still shows data; both absent = not connected. */
    private boolean available() {
        return github.configured() || releases.count() > 0;
    }

    /** app -> env -> currently deployed version, from the pipeline's state files. */
    private Map<String, Map<String, String>> deployedVersions() {
        Map<String, Map<String, String>> byApp = new HashMap<>();
        for (DeployState state : deployStates.read()) {
            if (state.version() != null) {
                byApp.computeIfAbsent(state.app(), a -> new HashMap<>())
                        .put(state.env(), state.version());
            }
        }
        return byApp;
    }

    /** tag -> the next-older tag in the timeline (for GitHub compare links). */
    private static Map<String, String> previousTags(List<Release> newestFirst) {
        Map<String, String> previous = new HashMap<>();
        for (int i = 0; i < newestFirst.size() - 1; i++) {
            previous.put(newestFirst.get(i).getTag(), newestFirst.get(i + 1).getTag());
        }
        return previous;
    }

    /**
     * How many stable releases prod trails the newest one; null when prod's
     * version isn't a known release (e.g. nothing deployed, or a test build).
     */
    static Integer prodBehind(List<Release> newestFirst, String prodVersion) {
        if (prodVersion == null) {
            return null;
        }
        int position = 0;
        for (Release release : newestFirst) {
            if (release.isPrerelease()) {
                continue;
            }
            if (prodVersion.equals(release.getTag())) {
                return position;
            }
            position++;
        }
        return null;
    }

    private ReleaseDto toDto(Release release, Map<String, Map<String, String>> deployed,
                             String previousTag) {
        Map<String, String> envs = deployed.getOrDefault(release.getApp(), Map.of());
        // pipeline identity triple: image name = app name (NOT the repo name)
        String imageRef = "ghcr.io/" + github.org() + "/" + release.getApp()
                + ":" + release.getTag();
        String compareUrl = previousTag == null ? null
                : "https://github.com/" + github.org() + "/" + release.getRepo()
                + "/compare/" + previousTag + "..." + release.getTag();
        return new ReleaseDto(release.getApp(), release.getRepo(), release.getTag(),
                release.getName(), release.getBody(), release.isPrerelease(),
                release.getHtmlUrl(), release.getPublishedAt(),
                release.getTag().equals(envs.get("prod")),
                release.getTag().equals(envs.get("test")),
                imageRef, compareUrl, release.getAssets());
    }
}
