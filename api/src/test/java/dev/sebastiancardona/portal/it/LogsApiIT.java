package dev.sebastiancardona.portal.it;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * The logs module API (/api/logs/**): admin-gated before anything else, honest
 * "not connected" answers when no Loki is configured (this IT environment), and
 * DQL errors as 400s with a position the query bar can underline.
 */
class LogsApiIT extends AbstractIT {

    @Test
    void viewerIsRefused() {
        String viewer = recruiterToken();
        assertThat(get("/api/logs/fields", viewer).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(get("/api/logs/query?q=fetch+logs", viewer).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(get("/api/logs/tail?q=fetch+logs", viewer).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void fieldsSayNotConnectedInsteadOfFailing() {
        var response = get("/api/logs/fields", adminToken());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("available")).isEqualTo(false);
    }

    @Test
    void queryWithoutLokiIsAnHonest503() {
        var response = get("/api/logs/query?q=fetch+logs", adminToken());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat((String) response.getBody().get("detail")).contains("not connected");
    }

    @Test
    void dqlErrorsAre400WithPosition() {
        var response = get("/api/logs/query?q=fetch+logs+|+explode", adminToken());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat((String) response.getBody().get("detail")).contains("unknown stage");
        assertThat(response.getBody().get("position")).isEqualTo(13);
    }

    @Test
    void unknownRangeIs400() {
        var response = get("/api/logs/query?q=fetch+logs&range=99y", adminToken());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
