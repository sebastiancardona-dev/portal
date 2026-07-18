package dev.sebastiancardona.portal.it;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/**
 * The accounts relay (/api/accounts/**): admin-gated in the portal BEFORE any
 * upstream call, and honest about a dead auth service (502, not a 500 or a hang).
 * The happy path through a live auth service is covered by the manual sso-e2e
 * drive — here the upstream is a dead port by construction (see AbstractIT).
 */
class AccountsApiIT extends AbstractIT {

    @Test
    void viewerIsRefusedBeforeAnyUpstreamCall() {
        String viewer = recruiterToken();
        assertThat(get("/api/accounts/users", viewer).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(get("/api/accounts/invites", viewer).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(get("/api/accounts/audit", viewer).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(post("/api/accounts/invites", viewer,
                Map.of("group", "friend", "ttlDays", 7, "maxUses", 1)).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(exchange(HttpMethod.DELETE,
                "/api/accounts/invites/00000000-0000-0000-0000-000000000000", viewer, null)
                .getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void adminGetsBadGatewayWhenAuthServiceIsDown() {
        var response = get("/api/accounts/users", adminToken());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(response.getBody().get("detail")).isEqualTo("auth service unreachable");
    }

    @Test
    void anonymousIsUnauthorized() {
        assertThat(get("/api/accounts/users", null).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
