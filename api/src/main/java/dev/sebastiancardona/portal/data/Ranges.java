package dev.sebastiancardona.portal.data;

import java.time.Duration;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lenient parsing of range/bucket shorthands: 30m, 1h, 6h, 24h, 7d (also s/w,
 * whitespace, uppercase, and full ISO-8601 durations). Unknown input falls back
 * to the caller's default — a widget with a typo still renders something.
 */
public final class Ranges {

    private static final Pattern SHORTHAND =
            Pattern.compile("(\\d+)\\s*(s|m|min|h|hr|d|w)");

    public static Duration parse(String raw, Duration fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        String value = raw.strip().toLowerCase(Locale.ROOT);
        Matcher m = SHORTHAND.matcher(value);
        if (m.matches()) {
            long amount = Long.parseLong(m.group(1));
            return switch (m.group(2)) {
                case "s" -> Duration.ofSeconds(amount);
                case "m", "min" -> Duration.ofMinutes(amount);
                case "h", "hr" -> Duration.ofHours(amount);
                case "d" -> Duration.ofDays(amount);
                case "w" -> Duration.ofDays(amount * 7);
                default -> fallback;
            };
        }
        if (value.startsWith("p")) {
            try {
                return Duration.parse(value.toUpperCase(Locale.ROOT));
            } catch (Exception e) {
                return fallback;
            }
        }
        return fallback;
    }

    private Ranges() {
    }
}
