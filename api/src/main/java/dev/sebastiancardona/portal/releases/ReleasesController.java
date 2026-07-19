package dev.sebastiancardona.portal.releases;

import dev.sebastiancardona.portal.releases.ReleasesService.AppReleasesDto;
import dev.sebastiancardona.portal.releases.ReleasesService.FeedDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Release timeline + artifact access. Deliberately NOT admin-gated (unlike
 * /api/logs): release metadata carries no PII, and the cadence is exactly what
 * a viewer (recruiter) should get to see. Everything is read-from-cache.
 */
@RestController
@RequestMapping("/api/releases")
public class ReleasesController {

    private static final int MAX_FEED = 100;

    private final ReleasesService service;

    public ReleasesController(ReleasesService service) {
        this.service = service;
    }

    @GetMapping
    FeedDto feed(@RequestParam(name = "limit", defaultValue = "20") int limit) {
        return service.feed(Math.min(Math.max(limit, 1), MAX_FEED));
    }

    @GetMapping("/{app}")
    AppReleasesDto app(@PathVariable("app") String app) {
        return service.forApp(app);
    }
}
