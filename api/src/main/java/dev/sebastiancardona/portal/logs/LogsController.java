package dev.sebastiancardona.portal.logs;

import dev.sebastiancardona.portal.common.ApiExceptions.ForbiddenException;
import dev.sebastiancardona.portal.common.CurrentUser;
import dev.sebastiancardona.portal.logs.LogsService.LogEntry;
import dev.sebastiancardona.portal.logs.LogsService.LogsResult;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The logs module API (project 07). Admin-only in v1: log lines carry user
 * emails (auth audit principals), so viewer exposure waits until the scrubbing
 * story is proven — the safe default, documented in plan/07.
 */
@RestController
@RequestMapping("/api/logs")
public class LogsController {

    /** Same vocabulary as the metrics ranges the operators already use. */
    private static final Map<String, Duration> RANGES = Map.of(
            "30m", Duration.ofMinutes(30),
            "1h", Duration.ofHours(1),
            "6h", Duration.ofHours(6),
            "24h", Duration.ofHours(24),
            "7d", Duration.ofDays(7));

    private final LogsService logs;
    private final LokiClient loki;

    public LogsController(LogsService logs, LokiClient loki) {
        this.logs = logs;
        this.loki = loki;
    }

    @GetMapping("/query")
    LogsResult query(@AuthenticationPrincipal Jwt jwt,
                     @RequestParam("q") String dql,
                     @RequestParam(defaultValue = "1h") String range) {
        requireAdmin(jwt);
        return logs.run(dql, range(range), Instant.now());
    }

    public record TailResponse(List<LogEntry> entries, String nowNs) {}

    /** Short-poll live tail: pass back nowNs as sinceNs on the next call. */
    @GetMapping("/tail")
    TailResponse tail(@AuthenticationPrincipal Jwt jwt,
                      @RequestParam("q") String dql,
                      @RequestParam(required = false) String sinceNs) {
        requireAdmin(jwt);
        Instant now = Instant.now();
        Instant since = sinceNs == null
                ? now.minus(Duration.ofMinutes(5))
                : fromNanos(sinceNs).plusNanos(1); // never re-send the last seen line
        return new TailResponse(logs.tail(dql, since, now), toNanos(now));
    }

    public record Fields(boolean available, List<String> apps, List<String> envs, List<String> levels) {}

    /** Filter dropdown values; available=false = pipeline not connected here. */
    @GetMapping("/fields")
    Fields fields(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        if (!logs.available()) {
            return new Fields(false, List.of(), List.of(), List.of());
        }
        Instant now = Instant.now();
        Instant dayAgo = now.minus(Duration.ofHours(24));
        return new Fields(true,
                loki.labelValues("app", dayAgo, now),
                loki.labelValues("env", dayAgo, now),
                loki.labelValues("level", dayAgo, now));
    }

    private static Duration range(String key) {
        Duration duration = RANGES.get(key);
        if (duration == null) {
            throw new IllegalArgumentException("unknown range " + key + " — use " + RANGES.keySet());
        }
        return duration;
    }

    private static void requireAdmin(Jwt jwt) {
        if (!CurrentUser.isAdmin(jwt)) {
            throw new ForbiddenException("admin only");
        }
    }

    private static Instant fromNanos(String nanos) {
        long value = Long.parseLong(nanos);
        return Instant.ofEpochSecond(value / 1_000_000_000L, value % 1_000_000_000L);
    }

    private static String toNanos(Instant instant) {
        return instant.getEpochSecond() + String.format("%09d", instant.getNano());
    }
}
