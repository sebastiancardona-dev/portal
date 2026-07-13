package dev.sebastiancardona.portal.data;

import dev.sebastiancardona.portal.config.PortalProps;
import dev.sebastiancardona.portal.discovery.DeployLogReader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class DeploysControllerTest {

    @TempDir
    Path dir;

    private DeploysController controller(String logContent) throws IOException {
        Path logFile = dir.resolve("deploy.log");
        Files.writeString(logFile, logContent);
        var props = new PortalProps(
                new PortalProps.Deploy(dir.toString(), logFile.toString()),
                new PortalProps.Docker(""),
                new PortalProps.Host(dir.toString(), dir.toString()));
        return new DeploysController(new DeployLogReader(props));
    }

    @Test
    void eventsComeBackNewestFirstAcrossApps() throws IOException {
        var controller = controller("""
                2026-07-10T08:00:00Z [moneytrckr/prod] requested
                2026-07-10T08:01:00Z [moneytrckr/prod] healthy
                2026-07-11T09:00:00Z [auth/prod] requested
                2026-07-11T09:02:00Z [auth/prod] FAILED
                """);

        var events = controller.deploys();
        assertThat(events).hasSize(4);
        assertThat(events.getFirst().ts()).isEqualTo(Instant.parse("2026-07-11T09:02:00Z"));
        assertThat(events.getFirst().app()).isEqualTo("auth");
        assertThat(events.getFirst().event()).isEqualTo("FAILED");
        assertThat(events.getLast().ts()).isEqualTo(Instant.parse("2026-07-10T08:00:00Z"));
        assertThat(events).isSortedAccordingTo(
                (a, b) -> b.ts().compareTo(a.ts()));
    }

    @Test
    void feedIsCappedAtFiftyEvents() throws IOException {
        String lines = IntStream.range(0, 80)
                .mapToObj(i -> "2026-07-01T%02d:%02d:00Z [portal/prod] healthy".formatted(i / 60, i % 60))
                .collect(Collectors.joining("\n"));
        var controller = controller(lines);

        List<DeploysController.DeployEventDto> events = controller.deploys();
        assertThat(events).hasSize(50);
        // newest first: the cap keeps the most recent events, drops the oldest
        assertThat(events.getFirst().ts()).isEqualTo(Instant.parse("2026-07-01T01:19:00Z"));
        assertThat(events.getLast().ts()).isEqualTo(Instant.parse("2026-07-01T00:30:00Z"));
    }

    @Test
    void missingLogMeansEmptyFeed() {
        var props = new PortalProps(
                new PortalProps.Deploy(dir.toString(), dir.resolve("nope.log").toString()),
                new PortalProps.Docker(""),
                new PortalProps.Host(dir.toString(), dir.toString()));
        var controller = new DeploysController(new DeployLogReader(props));
        assertThat(controller.deploys()).isEmpty();
    }
}
