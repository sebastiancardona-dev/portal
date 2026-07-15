package dev.sebastiancardona.portal.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Bridges the BFF session to the API's Jwt contract: for /api requests riding a
 * browser session (OAuth2AuthenticationToken), fetch the session's ecosystem access
 * token — refreshed by the manager when expired — decode it, and install the
 * EcosystemIdentity-mapped JwtAuthenticationToken for the rest of the chain.
 * A dead session (refresh token expired/revoked on the auth service) clears the
 * context → 401 → the SPA restarts the login redirect. Single sign-out lands here.
 */
@Component
public class TokenRelayFilter extends OncePerRequestFilter {

    private final OAuth2AuthorizedClientManager clientManager;
    private final JwtDecoder jwtDecoder;
    private final EcosystemIdentity identity;

    public TokenRelayFilter(@Lazy OAuth2AuthorizedClientManager clientManager,
                            @Lazy JwtDecoder jwtDecoder, EcosystemIdentity identity) {
        this.clientManager = clientManager;
        this.jwtDecoder = jwtDecoder;
        this.identity = identity;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!request.getRequestURI().startsWith("/api/")) return true;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return !(auth instanceof OAuth2AuthenticationToken);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        var session = (OAuth2AuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        try {
            OAuth2AuthorizedClient client = clientManager.authorize(
                    OAuth2AuthorizeRequest.withClientRegistrationId(session.getAuthorizedClientRegistrationId())
                            .principal(session)
                            .attribute(HttpServletRequest.class.getName(), request)
                            .attribute(HttpServletResponse.class.getName(), response)
                            .build());
            if (client == null) {
                SecurityContextHolder.clearContext();
            } else {
                Jwt jwt = jwtDecoder.decode(client.getAccessToken().getTokenValue());
                SecurityContextHolder.getContext().setAuthentication(identity.convert(jwt));
            }
        } catch (Exception e) {
            // refresh rejected (rotation reuse, revocation, expiry) or JWKS hiccup:
            // the session is no longer backed by a live grant
            SecurityContextHolder.clearContext();
        }
        chain.doFilter(request, response);
    }
}
