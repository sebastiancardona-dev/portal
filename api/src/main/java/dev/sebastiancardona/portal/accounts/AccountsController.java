package dev.sebastiancardona.portal.accounts;

import com.fasterxml.jackson.databind.JsonNode;
import dev.sebastiancardona.portal.common.ApiExceptions.ForbiddenException;
import dev.sebastiancardona.portal.common.CurrentUser;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The accounts/SSO dashboard API (the auth admin UI project 05 deferred to the
 * portal). Admin only, twice: gated here, and the relayed token is re-checked by
 * the auth service. The local Jwt keeps the ecosystem token's raw value
 * (EcosystemIdentity), so getTokenValue() is a valid bearer upstream — for
 * browser sessions it is the session's auto-refreshed access token.
 */
@RestController
@RequestMapping("/api/accounts")
public class AccountsController {

    private final AuthAdminClient authAdmin;

    public AccountsController(AuthAdminClient authAdmin) {
        this.authAdmin = authAdmin;
    }

    @GetMapping("/users")
    JsonNode users(@AuthenticationPrincipal Jwt jwt) {
        return authAdmin.users(relay(jwt));
    }

    @PatchMapping("/users/{id}")
    JsonNode patchUser(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
                       @RequestBody Map<String, Object> body) {
        return authAdmin.patchUser(relay(jwt), id, body);
    }

    @GetMapping("/invites")
    JsonNode invites(@AuthenticationPrincipal Jwt jwt) {
        return authAdmin.invites(relay(jwt));
    }

    @PostMapping("/invites")
    JsonNode mintInvite(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> body) {
        return authAdmin.mintInvite(relay(jwt), body);
    }

    @DeleteMapping("/invites/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void revokeInvite(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        authAdmin.revokeInvite(relay(jwt), id);
    }

    @GetMapping("/clients")
    JsonNode clients(@AuthenticationPrincipal Jwt jwt) {
        return authAdmin.clients(relay(jwt));
    }

    @GetMapping("/audit")
    JsonNode audit(@AuthenticationPrincipal Jwt jwt,
                   @RequestParam(defaultValue = "100") int limit) {
        return authAdmin.audit(relay(jwt), limit);
    }

    private static String relay(Jwt jwt) {
        if (!CurrentUser.isAdmin(jwt)) {
            throw new ForbiddenException("admin only");
        }
        return jwt.getTokenValue();
    }
}
