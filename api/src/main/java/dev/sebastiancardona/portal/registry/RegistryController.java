package dev.sebastiancardona.portal.registry;

import dev.sebastiancardona.portal.common.ApiExceptions.ForbiddenException;
import dev.sebastiancardona.portal.common.ApiExceptions.NotFoundException;
import dev.sebastiancardona.portal.common.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** CRUD for display overrides. Admin only (v1 has only admins, 05 adds recruiters). */
@RestController
@RequestMapping("/api/registry")
public class RegistryController {

    private final AppOverrideRepository overrides;

    public RegistryController(AppOverrideRepository overrides) {
        this.overrides = overrides;
    }

    public record OverrideView(String app, String displayName, String icon, boolean visible,
                               String healthPath, String baseHost) {

        static OverrideView of(AppOverride o) {
            return new OverrideView(o.getApp(), o.getDisplayName(), o.getIcon(),
                    o.isVisible(), o.getHealthPath(), o.getBaseHost());
        }
    }

    public record OverrideRequest(String displayName, String icon, Boolean visible,
                                  String healthPath, String baseHost) {
    }

    @GetMapping
    List<OverrideView> list(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return overrides.findAll().stream().map(OverrideView::of).toList();
    }

    @GetMapping("/{app}")
    OverrideView get(@AuthenticationPrincipal Jwt jwt, @PathVariable String app) {
        requireAdmin(jwt);
        return overrides.findById(app).map(OverrideView::of)
                .orElseThrow(() -> new NotFoundException("no override for " + app));
    }

    @PutMapping("/{app}")
    @Transactional
    public OverrideView upsert(@AuthenticationPrincipal Jwt jwt, @PathVariable String app,
                               @RequestBody OverrideRequest request) {
        requireAdmin(jwt);
        AppOverride override = overrides.findById(app).orElseGet(() -> new AppOverride(app));
        override.setDisplayName(blankToNull(request.displayName()));
        override.setIcon(blankToNull(request.icon()));
        override.setVisible(request.visible() == null || request.visible());
        override.setHealthPath(blankToNull(request.healthPath()));
        override.setBaseHost(stripHost(request.baseHost()));
        return OverrideView.of(overrides.save(override));
    }

    @DeleteMapping("/{app}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String app) {
        requireAdmin(jwt);
        overrides.deleteById(app);
    }

    private static void requireAdmin(Jwt jwt) {
        if (!CurrentUser.isAdmin(jwt)) {
            throw new ForbiddenException("admin only");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    /** Stored as a bare host — tolerate a pasted URL or trailing slash. */
    private static String stripHost(String value) {
        String host = blankToNull(value);
        if (host == null) {
            return null;
        }
        host = host.replaceFirst("^https?://", "");
        return host.endsWith("/") ? host.substring(0, host.length() - 1) : host;
    }
}
