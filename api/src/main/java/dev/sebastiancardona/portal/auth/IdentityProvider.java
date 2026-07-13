package dev.sebastiancardona.portal.auth;

import java.util.Optional;
import java.util.UUID;

/**
 * The auth seam. v1 binds {@link LocalIdentityProvider} (single admin from env);
 * project 05 replaces the implementation with OIDC without touching anything
 * outside auth/ and config/SecurityConfig.
 */
public interface IdentityProvider {

    Optional<Identity> authenticate(String email, String password);

    record Identity(UUID id, String email, String role) {
    }
}
