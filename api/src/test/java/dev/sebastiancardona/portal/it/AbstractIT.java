package dev.sebastiancardona.portal.it;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.testcontainers.containers.PostgreSQLContainer;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Base for integration tests: one shared Postgres container + Spring context.
 * Since the project-05 SSO swap there is no local login — tests mint HMAC tokens
 * SHAPED like the auth service's (sub=email, uid, groups, name) against a test-only
 * decoder, so every call exercises the real EcosystemIdentity mapping incl. JIT
 * provisioning. Excluded from the default build (needs Docker);
 * run with ./mvnw verify -Pintegration.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.docker.compose.enabled=false",
        // discovery/collector sources deliberately absent: the app must cope
        "portal.deploy.state-dir=target/it-missing/deploy-state",
        "portal.deploy.log-file=target/it-missing/deploy.log",
        "portal.host.proc=target/it-missing/proc",
        "portal.host.disk-path=target/it-missing/disk"
})
@Import(AbstractIT.TestDecoder.class) // nested @TestConfiguration isn't inherited by itself
public abstract class AbstractIT {

    public static final String ADMIN_EMAIL = "admin@it.local";
    static final String HMAC_SECRET = "it-only-hmac-secret-0123456789abcdef0123456789";

    // Singleton container (NOT @Container: JUnit would stop it after the first test
    // class while the cached Spring context still points at its port). Testcontainers'
    // Ryuk reaps it when the JVM exits.
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    static {
        POSTGRES.start();
    }

    @TestConfiguration
    static class TestDecoder {
        @Bean
        @Primary
        JwtDecoder testJwtDecoder() {
            return NimbusJwtDecoder.withSecretKey(
                            new SecretKeySpec(HMAC_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
                    .macAlgorithm(MacAlgorithm.HS256)
                    .build();
        }
    }

    /** Stable per-email auth uid, like the auth service would issue. */
    private static final Map<String, UUID> AUTH_UIDS = new ConcurrentHashMap<>();

    @Autowired
    protected TestRestTemplate http;

    protected ResponseEntity<Map<String, Object>> post(String path, String token, Object body) {
        return exchange(HttpMethod.POST, path, token, body);
    }

    protected ResponseEntity<Map<String, Object>> get(String path, String token) {
        return exchange(HttpMethod.GET, path, token, null);
    }

    protected ResponseEntity<Map<String, Object>> put(String path, String token, Object body) {
        return exchange(HttpMethod.PUT, path, token, body);
    }

    @SuppressWarnings("unchecked")
    protected ResponseEntity<List<Map<String, Object>>> getList(String path, String token) {
        return http.exchange(path, HttpMethod.GET, new HttpEntity<>(null, headers(token)),
                (Class<List<Map<String, Object>>>) (Class<?>) List.class);
    }

    @SuppressWarnings("unchecked")
    protected ResponseEntity<Map<String, Object>> exchange(HttpMethod method, String path,
                                                           String token, Object body) {
        return http.exchange(path, method, new HttpEntity<>(body, headers(token)),
                (Class<Map<String, Object>>) (Class<?>) Map.class);
    }

    private static HttpHeaders headers(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return headers;
    }

    /** Mints an ecosystem-shaped access token; the API JIT-provisions on first use. */
    protected String mintToken(String email, String displayName, List<String> groups) {
        try {
            UUID uid = AUTH_UIDS.computeIfAbsent(email, e -> UUID.randomUUID());
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(email)
                    .issuer("https://auth-it.local")
                    .claim("uid", uid.toString())
                    .claim("groups", groups)
                    .claim("name", displayName)
                    .issueTime(new Date())
                    .expirationTime(new Date(System.currentTimeMillis() + 600_000))
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            jwt.sign(new MACSigner(HMAC_SECRET.getBytes(StandardCharsets.UTF_8)));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    protected String adminToken() {
        return mintToken(ADMIN_EMAIL, "IT Admin", List.of("admin"));
    }

    /** A recruiter: valid session, viewer role — read-only by mapping. */
    protected String recruiterToken() {
        return mintToken("recruiter@it.local", "IT Recruiter", List.of("recruiter"));
    }
}
