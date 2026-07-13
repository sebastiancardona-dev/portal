package dev.sebastiancardona.portal.discovery;

import dev.sebastiancardona.portal.config.PortalProps;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses the pipeline's append-only deploy log:
 * {@code <ISO-ts> [<app>/<env>] <event>} (requested/healthy/FAILED/rollback).
 * Unparseable lines are tolerated (skipped); a missing file means no history.
 */
@Component
public class DeployLogReader {

    private static final Logger log = LoggerFactory.getLogger(DeployLogReader.class);

    private static final Pattern LINE =
            Pattern.compile("^(\\S+)\\s+\\[([^/\\]]+)/([^\\]]+)]\\s+(.+)$");

    private final Path logFile;
    private final AtomicBoolean missLogged = new AtomicBoolean();

    public DeployLogReader(PortalProps props) {
        this.logFile = Path.of(props.deploy().logFile());
    }

    public record DeployEvent(Instant ts, String app, String env, String event) {
    }

    public List<DeployEvent> read() {
        if (!Files.isReadable(logFile)) {
            if (missLogged.compareAndSet(false, true)) {
                log.debug("deploy log {} not present — skipping this source", logFile);
            }
            return List.of();
        }
        try {
            return Files.readAllLines(logFile).stream()
                    .map(DeployLogReader::parseLine)
                    .flatMap(Optional::stream)
                    .toList();
        } catch (IOException e) {
            log.debug("failed reading deploy log {}: {}", logFile, e.toString());
            return List.of();
        }
    }

    public static Optional<DeployEvent> parseLine(String line) {
        Matcher m = LINE.matcher(line.strip());
        if (!m.matches()) {
            return Optional.empty();
        }
        Instant ts;
        try {
            ts = OffsetDateTime.parse(m.group(1)).toInstant();
        } catch (Exception e) {
            return Optional.empty();
        }
        return Optional.of(new DeployEvent(ts, m.group(2), m.group(3), m.group(4).strip()));
    }
}
