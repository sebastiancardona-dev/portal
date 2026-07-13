package dev.sebastiancardona.portal.data;

import java.util.Optional;

/**
 * The data-source id grammar (the widget contract — web/ builds against this):
 * `health:<app>:<env>` · `latency:<app>:<env>` · `host:<metric>` ·
 * `container:<name>:<metric>`. New apps/containers appear as new ids automatically.
 */
public record SourceId(Kind kind, String app, String env, String container, String metric) {

    public enum Kind { HEALTH, LATENCY, HOST, CONTAINER }

    public static Optional<SourceId> parse(String id) {
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        String[] parts = id.split(":", -1);
        for (String part : parts) {
            if (part.isBlank()) {
                return Optional.empty();
            }
        }
        return switch (parts[0]) {
            case "health" -> parts.length == 3
                    ? Optional.of(new SourceId(Kind.HEALTH, parts[1], parts[2], null, null))
                    : Optional.empty();
            case "latency" -> parts.length == 3
                    ? Optional.of(new SourceId(Kind.LATENCY, parts[1], parts[2], null, null))
                    : Optional.empty();
            case "host" -> parts.length == 2
                    ? Optional.of(new SourceId(Kind.HOST, null, null, null, parts[1]))
                    : Optional.empty();
            case "container" -> parts.length == 3
                    ? Optional.of(new SourceId(Kind.CONTAINER, null, null, parts[1], parts[2]))
                    : Optional.empty();
            default -> Optional.empty();
        };
    }

    public String id() {
        return switch (kind) {
            case HEALTH -> "health:" + app + ":" + env;
            case LATENCY -> "latency:" + app + ":" + env;
            case HOST -> "host:" + metric;
            case CONTAINER -> "container:" + container + ":" + metric;
        };
    }
}
