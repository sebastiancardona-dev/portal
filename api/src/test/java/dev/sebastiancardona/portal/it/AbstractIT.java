package dev.sebastiancardona.portal.it;

import org.junit.jupiter.api.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.testcontainers.containers.PostgreSQLContainer;

import java.util.List;
import java.util.Map;

/**
 * Base for integration tests: one shared Postgres container + Spring context,
 * an admin account seeded on first start. Excluded from the default build
 * (needs Docker); run with ./mvnw verify -Pintegration.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "portal.admin.email=" + AbstractIT.ADMIN_EMAIL,
        "portal.admin.password=" + AbstractIT.ADMIN_PASSWORD,
        "spring.docker.compose.enabled=false",
        // discovery/collector sources deliberately absent: the app must cope
        "portal.deploy.state-dir=target/it-missing/deploy-state",
        "portal.deploy.log-file=target/it-missing/deploy.log",
        "portal.host.proc=target/it-missing/proc",
        "portal.host.disk-path=target/it-missing/disk"
})
public abstract class AbstractIT {

    public static final String ADMIN_EMAIL = "admin@it.local";
    public static final String ADMIN_PASSWORD = "it-admin-password-123";

    // Singleton container (NOT @Container: JUnit would stop it after the first test
    // class while the cached Spring context still points at its port). Testcontainers'
    // Ryuk reaps it when the JVM exits.
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    static {
        POSTGRES.start();
    }

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

    /** Logs in and returns the access token. */
    protected String login(String email, String password) {
        var response = post("/api/auth/login", null, Map.of("email", email, "password", password));
        return (String) response.getBody().get("accessToken");
    }

    protected String adminToken() {
        return login(ADMIN_EMAIL, ADMIN_PASSWORD);
    }
}
