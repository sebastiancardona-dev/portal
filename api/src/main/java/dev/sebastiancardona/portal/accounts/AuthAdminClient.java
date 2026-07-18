package dev.sebastiancardona.portal.accounts;

import com.fasterxml.jackson.databind.JsonNode;
import dev.sebastiancardona.portal.common.ApiExceptions.ForbiddenException;
import dev.sebastiancardona.portal.common.ApiExceptions.UpstreamException;
import java.time.Duration;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Thin relay to the auth service's headless admin API (project 05). No portal-side
 * credentials: every call forwards the operator's own ecosystem access token, so
 * authorization stays where it belongs — the auth service checks the admin group,
 * and a viewer's token is refused there even if a portal bug let one through.
 * Payloads pass through as JSON untyped: the auth service owns those shapes.
 */
@Component
public class AuthAdminClient {

    private final RestClient http;

    public AuthAdminClient(@Value("${portal.oidc.issuer}") String issuer) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.http = RestClient.builder().baseUrl(issuer).requestFactory(factory).build();
    }

    public JsonNode users(String token) {
        return call(() -> http.get().uri("/api/admin/users")
                .headers(h -> h.setBearerAuth(token)).retrieve().body(JsonNode.class));
    }

    public JsonNode patchUser(String token, String id, Map<String, Object> body) {
        return call(() -> http.patch().uri("/api/admin/users/{id}", id)
                .headers(h -> h.setBearerAuth(token)).body(body).retrieve().body(JsonNode.class));
    }

    public JsonNode invites(String token) {
        return call(() -> http.get().uri("/api/admin/invites")
                .headers(h -> h.setBearerAuth(token)).retrieve().body(JsonNode.class));
    }

    public JsonNode mintInvite(String token, Map<String, Object> body) {
        return call(() -> http.post().uri("/api/admin/invites")
                .headers(h -> h.setBearerAuth(token)).body(body).retrieve().body(JsonNode.class));
    }

    public void revokeInvite(String token, String id) {
        call(() -> http.delete().uri("/api/admin/invites/{id}", id)
                .headers(h -> h.setBearerAuth(token)).retrieve().toBodilessEntity());
    }

    public JsonNode clients(String token) {
        return call(() -> http.get().uri("/api/admin/clients")
                .headers(h -> h.setBearerAuth(token)).retrieve().body(JsonNode.class));
    }

    public JsonNode audit(String token, int limit) {
        return call(() -> http.get().uri("/api/admin/audit?limit={limit}", limit)
                .headers(h -> h.setBearerAuth(token)).retrieve().body(JsonNode.class));
    }

    private <T> T call(Supplier<T> request) {
        try {
            return request.get();
        } catch (HttpStatusCodeException e) {
            int status = e.getStatusCode().value();
            if (status == 401 || status == 403) {
                throw new ForbiddenException("the auth service refused the relayed token");
            }
            throw new UpstreamException(status, upstreamDetail(e));
        } catch (RestClientException e) {
            throw new UpstreamException(502, "auth service unreachable");
        }
    }

    /** Surface the auth service's own error message (e.g. invite validation). */
    private static String upstreamDetail(HttpStatusCodeException e) {
        String body = e.getResponseBodyAsString();
        return body.isBlank() ? "auth service error" : body;
    }
}
