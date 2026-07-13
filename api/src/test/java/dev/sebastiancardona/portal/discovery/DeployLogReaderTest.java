package dev.sebastiancardona.portal.discovery;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class DeployLogReaderTest {

    @Test
    void parsesGoodLine() {
        var event = DeployLogReader.parseLine(
                "2026-07-12T19:39:41Z [moneytrckr/prod] requested").orElseThrow();
        assertThat(event.ts()).isEqualTo(Instant.parse("2026-07-12T19:39:41Z"));
        assertThat(event.app()).isEqualTo("moneytrckr");
        assertThat(event.env()).isEqualTo("prod");
        assertThat(event.event()).isEqualTo("requested");
    }

    @Test
    void parsesRollbackAndFailedLines() {
        var failed = DeployLogReader.parseLine(
                "2026-07-11T16:20:48Z [swiss-dev-tools/prod] FAILED").orElseThrow();
        assertThat(failed.event()).isEqualTo("FAILED");
        assertThat(failed.app()).isEqualTo("swiss-dev-tools");

        var rollback = DeployLogReader.parseLine(
                "2026-07-11T16:21:14Z [swiss-dev-tools/prod] rollback").orElseThrow();
        assertThat(rollback.event()).isEqualTo("rollback");
    }

    @Test
    void parsesOffsetTimestamps() {
        var event = DeployLogReader.parseLine(
                "2026-07-11T16:58:04-06:00 [swiss-dev-tools/prod] healthy").orElseThrow();
        assertThat(event.ts()).isEqualTo(Instant.parse("2026-07-11T22:58:04Z"));
    }

    @Test
    void multiWordEventsSurviveWhole() {
        var event = DeployLogReader.parseLine(
                "2026-07-12T19:40:55Z [moneytrckr/prod] healthy after 2 retries").orElseThrow();
        assertThat(event.event()).isEqualTo("healthy after 2 retries");
    }

    @Test
    void toleratesGarbage() {
        assertThat(DeployLogReader.parseLine("")).isEmpty();
        assertThat(DeployLogReader.parseLine("# deploy log v1")).isEmpty();
        assertThat(DeployLogReader.parseLine("not-a-timestamp [app/prod] healthy")).isEmpty();
        assertThat(DeployLogReader.parseLine("2026-07-12T19:40:55Z no brackets here")).isEmpty();
        assertThat(DeployLogReader.parseLine("2026-07-12T19:40:55Z [missing-env] healthy"))
                .isEmpty();
    }
}
