package dev.sebastiancardona.portal.discovery;

import dev.sebastiancardona.portal.config.PortalProps;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DeployStateReaderTest {

    @TempDir
    Path dir;

    private DeployStateReader reader() {
        return new DeployStateReader(props(dir.toString()));
    }

    private static PortalProps props(String stateDir) {
        return new PortalProps(
                new PortalProps.Deploy(stateDir, "unused.log"),
                new PortalProps.Docker(""),
                new PortalProps.Host("/nope", "/nope"));
    }

    @Test
    void parsesFilenamesIncludingHyphenatedApps() {
        assertThat(DeployStateReader.parseFilename("moneytrckr-prod.json").orElseThrow())
                .isEqualTo(new DeployStateReader.AppEnv("moneytrckr", "prod"));
        assertThat(DeployStateReader.parseFilename("swiss-dev-tools-test.json").orElseThrow())
                .isEqualTo(new DeployStateReader.AppEnv("swiss-dev-tools", "test"));
        assertThat(DeployStateReader.parseFilename("notjson.txt")).isEmpty();
        assertThat(DeployStateReader.parseFilename("nodash.json")).isEmpty();
    }

    @Test
    void readsStateFiles() throws Exception {
        Files.writeString(dir.resolve("moneytrckr-prod.json"),
                """
                {"app":"moneytrckr","env":"prod","version":"v0.4.0",\
                "status":"success","timestamp":"2026-07-12T19:40:55Z"}""");
        List<DeployState> states = reader().read();
        assertThat(states).containsExactly(new DeployState("moneytrckr", "prod", "v0.4.0",
                "success", Instant.parse("2026-07-12T19:40:55Z")));
    }

    @Test
    void fallsBackToFilenameWhenJsonLacksIdentity() throws Exception {
        Files.writeString(dir.resolve("hello-ecosystem-test.json"),
                "{\"version\":\"v0.2.1\",\"status\":\"success\"}");
        List<DeployState> states = reader().read();
        assertThat(states).hasSize(1);
        assertThat(states.getFirst().app()).isEqualTo("hello-ecosystem");
        assertThat(states.getFirst().env()).isEqualTo("test");
        assertThat(states.getFirst().timestamp()).isNull();
    }

    @Test
    void parsesOffsetTimestamps() throws Exception {
        Files.writeString(dir.resolve("swiss-dev-tools-prod.json"),
                """
                {"app":"swiss-dev-tools","env":"prod","version":"v0.1.0",\
                "status":"success","timestamp":"2026-07-11T16:58:04-06:00"}""");
        assertThat(reader().read().getFirst().timestamp())
                .isEqualTo(Instant.parse("2026-07-11T22:58:04Z"));
    }

    @Test
    void skipsGarbageFilesAndKeepsGoodOnes() throws Exception {
        Files.writeString(dir.resolve("broken-prod.json"), "{not json at all");
        Files.writeString(dir.resolve("ignored.txt"), "not even json");
        Files.writeString(dir.resolve("moneytrckr-prod.json"),
                "{\"app\":\"moneytrckr\",\"env\":\"prod\",\"version\":\"v0.4.0\"}");
        List<DeployState> states = reader().read();
        assertThat(states).hasSize(1);
        assertThat(states.getFirst().app()).isEqualTo("moneytrckr");
    }

    @Test
    void missingDirectoryIsEmptyNotFatal() {
        DeployStateReader reader = new DeployStateReader(
                props(dir.resolve("does-not-exist").toString()));
        assertThat(reader.read()).isEmpty();
    }
}
