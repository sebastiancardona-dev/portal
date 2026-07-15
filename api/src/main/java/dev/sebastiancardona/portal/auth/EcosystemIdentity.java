package dev.sebastiancardona.portal.auth;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.convert.converter.Converter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The OIDC identity mapper (project 05 fills the v1 seam — MoneyTrckr's pattern).
 *
 * Maps an ecosystem access token (sub=email, uid=auth id, groups, roles.portal)
 * onto the LOCAL user row dashboard layouts FK, JIT-provisioning on first login,
 * then re-issues the Jwt with sub=<local UUID> and role=<admin|viewer> — the exact
 * contract {@code CurrentUser} and every controller already spoke. Recruiters and
 * friends land as 'viewer': valid session, read-only (writes gate on isAdmin).
 */
@Component
public class EcosystemIdentity implements Converter<Jwt, AbstractAuthenticationToken> {

    private static final Logger log = LoggerFactory.getLogger(EcosystemIdentity.class);

    private final UserRepository users;

    public EcosystemIdentity(UserRepository users) {
        this.users = users;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AbstractAuthenticationToken convert(Jwt source) {
        User user = resolve(source);
        String role = mapRole(source);
        if (!user.getRole().equals(role)) {
            user.setRole(role); // groups changed on the auth service — mirror it
        }
        Jwt local = Jwt.withTokenValue(source.getTokenValue())
                .headers(h -> h.putAll(source.getHeaders()))
                .claims(c -> {
                    c.putAll(source.getClaims());
                    c.put("sub", user.getId().toString());
                    c.put("role", role);
                    c.put("email", user.getEmail());
                })
                .build();
        return new JwtAuthenticationToken(local,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)), user.getEmail());
    }

    private User resolve(Jwt jwt) {
        UUID authUid = jwt.hasClaim("uid") ? UUID.fromString(jwt.getClaimAsString("uid")) : null;
        String email = jwt.getSubject().toLowerCase().trim();

        if (authUid != null) {
            var byUid = users.findByAuthUid(authUid);
            if (byUid.isPresent()) return byUid.get();
        }
        var byEmail = users.findByEmailIgnoreCase(email);
        if (byEmail.isPresent()) {
            User existing = byEmail.get();
            if (authUid != null && existing.getAuthUid() == null) {
                existing.setAuthUid(authUid); // link a pre-SSO row on first OIDC login
                log.info("Linked existing user {} to ecosystem account {}", email, authUid);
            }
            return existing;
        }
        return provision(jwt, authUid, email);
    }

    private User provision(Jwt jwt, UUID authUid, String email) {
        String name = jwt.hasClaim("name") ? jwt.getClaimAsString("name")
                : email.substring(0, email.indexOf('@'));
        try {
            User user = users.save(new User(email, name, mapRole(jwt)));
            user.setAuthUid(authUid);
            log.info("JIT-provisioned user {} from ecosystem account {}", email, authUid);
            return user;
        } catch (DataIntegrityViolationException e) {
            // two first requests raced the insert — the other one won
            return users.findByEmailIgnoreCase(email).orElseThrow(() -> e);
        }
    }

    /** groups: admin → admin; per-app roles.portal override wins if present; else viewer. */
    private String mapRole(Jwt jwt) {
        Map<String, Object> roles = jwt.hasClaim("roles") ? jwt.getClaimAsMap("roles") : Map.of();
        Object appRoles = roles.get("portal");
        if (appRoles instanceof List<?> list) {
            if (list.contains("admin")) return "admin";
            if (list.contains("viewer")) return "viewer";
        }
        List<String> groups = jwt.getClaimAsStringList("groups");
        return groups != null && groups.contains("admin") ? "admin" : "viewer";
    }
}
