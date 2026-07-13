package dev.sebastiancardona.portal.data;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class RangesTest {

    private static final Duration FALLBACK = Duration.ofHours(6);

    @Test
    void parsesTheDocumentedShorthands() {
        assertThat(Ranges.parse("30m", FALLBACK)).isEqualTo(Duration.ofMinutes(30));
        assertThat(Ranges.parse("1h", FALLBACK)).isEqualTo(Duration.ofHours(1));
        assertThat(Ranges.parse("6h", FALLBACK)).isEqualTo(Duration.ofHours(6));
        assertThat(Ranges.parse("24h", FALLBACK)).isEqualTo(Duration.ofHours(24));
        assertThat(Ranges.parse("7d", FALLBACK)).isEqualTo(Duration.ofDays(7));
        assertThat(Ranges.parse("1m", FALLBACK)).isEqualTo(Duration.ofMinutes(1));
        assertThat(Ranges.parse("5m", FALLBACK)).isEqualTo(Duration.ofMinutes(5));
    }

    @Test
    void isLenientAboutCaseWhitespaceAndIsoDurations() {
        assertThat(Ranges.parse(" 6H ", FALLBACK)).isEqualTo(Duration.ofHours(6));
        assertThat(Ranges.parse("15 min", FALLBACK)).isEqualTo(Duration.ofMinutes(15));
        assertThat(Ranges.parse("2w", FALLBACK)).isEqualTo(Duration.ofDays(14));
        assertThat(Ranges.parse("PT30M", FALLBACK)).isEqualTo(Duration.ofMinutes(30));
    }

    @Test
    void fallsBackOnJunkInsteadOfFailing() {
        assertThat(Ranges.parse(null, FALLBACK)).isEqualTo(FALLBACK);
        assertThat(Ranges.parse("", FALLBACK)).isEqualTo(FALLBACK);
        assertThat(Ranges.parse("soon", FALLBACK)).isEqualTo(FALLBACK);
        assertThat(Ranges.parse("h6", FALLBACK)).isEqualTo(FALLBACK);
        assertThat(Ranges.parse("p-nonsense", FALLBACK)).isEqualTo(FALLBACK);
    }
}
