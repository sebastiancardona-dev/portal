package dev.sebastiancardona.portal.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.stream.Stream;

/**
 * Reads pipeline deploy-state files. The directory is optional (a dev machine has
 * none): missing dir or unreadable/garbage files are skipped, never fatal.
 */
@Component
public class DeployStateReader {

    private static final Logger log = LoggerFactory.getLogger(DeployStateReader.class);

    private final Path stateDir;
    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicBoolean missLogged = new AtomicBoolean();

    public DeployStateReader(PortalProps props) {
        this.stateDir = Path.of(props.deploy().stateDir());
    }

    public List<DeployState> read() {
        if (!Files.isDirectory(stateDir)) {
            if (missLogged.compareAndSet(false, true)) {
                log.debug("deploy state dir {} not present — skipping this source", stateDir);
            }
            return List.of();
        }
        try (Stream<Path> files = Files.list(stateDir)) {
            return files
                    .filter(f -> f.getFileName().toString().endsWith(".json"))
                    .sorted()
                    .map(this::parseFile)
                    .flatMap(Optional::stream)
                    .toList();
        } catch (IOException e) {
            log.debug("failed listing deploy state dir {}: {}", stateDir, e.toString());
            return List.of();
        }
    }

    Optional<DeployState> parseFile(Path file) {
        try {
            JsonNode json = mapper.readTree(Files.readString(file));
            Optional<AppEnv> fromName = parseFilename(file.getFileName().toString());
            String app = text(json, "app").orElseGet(() -> fromName.map(AppEnv::app).orElse(null));
            String env = text(json, "env").orElseGet(() -> fromName.map(AppEnv::env).orElse(null));
            if (app == null || env == null) {
                return Optional.empty();
            }
            return Optional.of(new DeployState(app, env,
                    text(json, "version").orElse(null),
                    text(json, "status").orElse(null),
                    text(json, "timestamp").map(DeployStateReader::parseTimestamp).orElse(null)));
        } catch (Exception e) {
            log.debug("unparseable deploy state file {}: {}", file, e.toString());
            return Optional.empty();
        }
    }

    /** ISO-8601 with offset (Z or ±hh:mm); null when unparseable. */
    static Instant parseTimestamp(String value) {
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (Exception e) {
            return null;
        }
    }

    public record AppEnv(String app, String env) {
    }

    /** `<app>-<env>.json` — app names may themselves contain hyphens. */
    public static Optional<AppEnv> parseFilename(String filename) {
        if (!filename.endsWith(".json")) {
            return Optional.empty();
        }
        String base = filename.substring(0, filename.length() - ".json".length());
        int split = base.lastIndexOf('-');
        if (split <= 0 || split == base.length() - 1) {
            return Optional.empty();
        }
        return Optional.of(new AppEnv(base.substring(0, split), base.substring(split + 1)));
    }

    private static Optional<String> text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() && !value.asText().isBlank()
                ? Optional.of(value.asText())
                : Optional.empty();
    }
}
