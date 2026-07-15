package dev.sebastiancardona.portal.config;

import dev.sebastiancardona.portal.auth.EcosystemIdentity;
import dev.sebastiancardona.portal.auth.TokenRelayFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProviderBuilder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

/**
 * SSO security (project 05 — MoneyTrckr's DESIGN §17 BFF pattern). The backend is
 * the OIDC confidential client: browsers hold only a session cookie; API
 * authentication is re-established per request from the session's (auto-refreshed)
 * ecosystem access token by {@link TokenRelayFilter}, or directly from a Bearer
 * header (resource-server path — how the integration tests drive the API). Both
 * paths funnel through {@link EcosystemIdentity}, so controllers keep their Jwt
 * contract untouched.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, TokenRelayFilter relay,
                                            EcosystemIdentity identity, JwtDecoder jwtDecoder,
                                            LogoutSuccessHandler rpInitiatedLogout) throws Exception {
        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/**").authenticated()
                        // everything else: the SPA, its assets, /health, /info —
                        // all static or intentionally public (ecosystem contract)
                        .anyRequest().permitAll())
                .csrf(csrf -> csrf
                        // SPA-readable cookie; client echoes it as X-XSRF-TOKEN on mutations
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
                        // bearer calls carry no cookies — no CSRF surface to protect
                        .ignoringRequestMatchers(request -> {
                            String authz = request.getHeader("Authorization");
                            return authz != null && authz.startsWith("Bearer ");
                        }))
                // deep links (page navigations) survive the login round-trip, but a
                // background fetch that 401'd must never become the landing page
                .requestCache(cache -> {
                    var sessionCache = new org.springframework.security.web.savedrequest.HttpSessionRequestCache();
                    sessionCache.setRequestMatcher(request -> !request.getRequestURI().startsWith("/api/"));
                    cache.requestCache(sessionCache);
                })
                .oauth2Login(login -> login
                        .defaultSuccessUrl("/", false)
                        // the auth service requires PKCE for EVERY client (RFC 9700);
                        // Spring only adds it for public clients unless told to
                        .authorizationEndpoint(authz ->
                                authz.authorizationRequestResolver(pkceResolver(http))))
                .logout(logout -> logout.logoutSuccessHandler(rpInitiatedLogout))
                .oauth2ResourceServer(rs -> rs.jwt(jwt -> jwt
                        .decoder(jwtDecoder)
                        .jwtAuthenticationConverter(identity)))
                .addFilterBefore(relay, AuthorizationFilter.class)
                // deferred CSRF: touch the token every request so the cookie actually
                // lands in the browser (Spring Security 6 SPA pattern)
                .addFilterAfter((request, response, chain) -> {
                    var token = (org.springframework.security.web.csrf.CsrfToken)
                            request.getAttribute(org.springframework.security.web.csrf.CsrfToken.class.getName());
                    if (token != null) token.getToken();
                    chain.doFilter(request, response);
                }, AuthorizationFilter.class)
                .exceptionHandling(e -> e.defaultAuthenticationEntryPointFor(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                        new AntPathRequestMatcher("/api/**")))
                .build();
    }

    private static OAuth2AuthorizationRequestResolver pkceResolver(HttpSecurity http) {
        ClientRegistrationRepository registrations =
                http.getSharedObject(org.springframework.context.ApplicationContext.class)
                        .getBean(ClientRegistrationRepository.class);
        var resolver = new DefaultOAuth2AuthorizationRequestResolver(
                registrations, "/oauth2/authorization");
        resolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
        return resolver;
    }

    /**
     * Lazy JWKS decoder: keys are fetched on first decode, never at boot — the app
     * must start even when the auth service is momentarily down (withIssuerLocation
     * would call the discovery endpoint during bean creation).
     */
    @Bean
    JwtDecoder jwtDecoder(@Value("${portal.oidc.issuer}") String issuer) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(issuer + "/oauth2/jwks").build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
        return decoder;
    }

    /** Refreshes the session's access token transparently (rotating refresh tokens). */
    @Bean
    OAuth2AuthorizedClientManager authorizedClientManager(
            ClientRegistrationRepository registrations,
            OAuth2AuthorizedClientRepository authorizedClients) {
        var manager = new DefaultOAuth2AuthorizedClientManager(registrations, authorizedClients);
        manager.setAuthorizedClientProvider(OAuth2AuthorizedClientProviderBuilder.builder()
                .authorizationCode()
                .refreshToken()
                .build());
        return manager;
    }

    /**
     * RP-initiated logout against the auth service (single sign-out v1: the central
     * session dies here; sibling apps drop off at their next token refresh, ≤10 min).
     * Built by hand because the client registration uses explicit endpoints (no
     * discovery at boot), so Spring's handler can't learn end_session_endpoint.
     */
    @Bean
    LogoutSuccessHandler rpInitiatedLogout(@Value("${portal.oidc.issuer}") String issuer,
                                           @Value("${portal.public-url}") String publicUrl) {
        return (request, response, authentication) -> {
            String url = issuer + "/connect/logout";
            if (authentication != null && authentication.getPrincipal() instanceof OidcUser oidc) {
                url += "?id_token_hint=" + oidc.getIdToken().getTokenValue()
                        + "&post_logout_redirect_uri=" + publicUrl;
            }
            response.sendRedirect(url);
        };
    }
}
