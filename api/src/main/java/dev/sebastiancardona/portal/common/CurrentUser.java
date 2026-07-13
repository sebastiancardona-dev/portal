package dev.sebastiancardona.portal.common;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/** Resolves the authenticated user's id (JWT subject) from the injected principal. */
public final class CurrentUser {

    public static UUID id(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    /** v1: the seeded local account is always admin; 05's OIDC maps groups → roles. */
    public static boolean isAdmin(Jwt jwt) {
        return "admin".equals(jwt.getClaim("role"));
    }

    private CurrentUser() {
    }
}
