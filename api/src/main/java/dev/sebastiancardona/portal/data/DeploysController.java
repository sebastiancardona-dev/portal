package dev.sebastiancardona.portal.data;

import dev.sebastiancardona.portal.discovery.DeployLogReader;
import dev.sebastiancardona.portal.discovery.DeployLogReader.DeployEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/**
 * Cross-app deploy feed: the last {@value #LIMIT} deploy-log events over ALL
 * apps, newest first. A missing/empty log simply yields an empty list.
 */
@RestController
@RequestMapping("/api/deploys")
public class DeploysController {

    static final int LIMIT = 50;

    private final DeployLogReader deployLog;

    public DeploysController(DeployLogReader deployLog) {
        this.deployLog = deployLog;
    }

    public record DeployEventDto(Instant ts, String app, String env, String event) {
    }

    @GetMapping
    List<DeployEventDto> deploys() {
        return deployLog.read().stream()
                .sorted(Comparator.comparing(DeployEvent::ts).reversed())
                .limit(LIMIT)
                .map(event -> new DeployEventDto(event.ts(), event.app(), event.env(), event.event()))
                .toList();
    }
}
