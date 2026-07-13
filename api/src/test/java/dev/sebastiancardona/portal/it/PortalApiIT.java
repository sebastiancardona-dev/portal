package dev.sebastiancardona.portal.it;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Context loads (which proves the Flyway V1 migration applies against a real
 * Postgres and the JPA schema validates), plus the auth flow, source enumeration
 * with every discovery source absent, and the dashboard layout roundtrip.
 */
class PortalApiIT extends AbstractIT {

    @Test
    void loginFlowIssuesUsableToken() {
        var bad = post("/api/auth/login", null,
                Map.of("email", ADMIN_EMAIL, "password", "wrong-password"));
        assertThat(bad.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        var login = post("/api/auth/login", null,
                Map.of("email", ADMIN_EMAIL, "password", ADMIN_PASSWORD));
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(login.getBody()).containsKey("accessToken");
        assertThat(((Number) login.getBody().get("expiresIn")).longValue()).isEqualTo(1800L);

        String token = (String) login.getBody().get("accessToken");
        var me = get("/api/me", token);
        assertThat(me.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(me.getBody()).containsEntry("email", ADMIN_EMAIL)
                .containsEntry("role", "admin");
    }

    @Test
    void apiRequiresAuthentication() {
        assertThat(get("/api/sources", null).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        // the ecosystem contract endpoints stay public
        assertThat(get("/health", null).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void sourcesCopeWithEveryDiscoverySourceAbsent() {
        var sources = getList("/api/sources", adminToken());
        assertThat(sources.getStatusCode()).isEqualTo(HttpStatus.OK);
        // no state dir, no docker, no collected host metrics → no host:* sources
        assertThat(sources.getBody())
                .noneMatch(source -> ((String) source.get("id")).startsWith("host:"));

        var host = get("/api/host", adminToken());
        assertThat(host.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(host.getBody().get("cpuPct")).isNull();
        // no disk metrics collected → the measured path is null too (never a lie)
        assertThat(host.getBody().get("diskPath")).isNull();
        assertThat((List<?>) host.getBody().get("containers")).isEmpty();

        var apps = getList("/api/apps", adminToken());
        assertThat(apps.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(apps.getBody()).isEmpty();

        var deploys = getList("/api/deploys", adminToken());
        assertThat(deploys.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(deploys.getBody()).isEmpty();
        assertThat(get("/api/deploys", null).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @SuppressWarnings("unchecked")
    void dashboardLayoutRoundTrips() {
        String token = adminToken();

        var initial = get("/api/dashboard/layout", token);
        assertThat(initial.getStatusCode()).isEqualTo(HttpStatus.OK);
        var defaultWidgets = (List<Map<String, Object>>) initial.getBody().get("widgets");
        assertThat(defaultWidgets).isNotEmpty(); // the hardcoded default
        assertThat(defaultWidgets).extracting(w -> w.get("type"))
                .contains("stat-tile", "gauge", "line-chart", "status-list",
                        "donut", "deploy-feed", "table");

        Map<String, Object> custom = Map.of("widgets", List.of(Map.of(
                "id", "w1", "type", "stat-tile", "x", 0, "y", 0, "w", 4, "h", 2,
                "config", Map.of("source", "host:cpu_pct", "arbitrary", Map.of("deep", true)))));
        var saved = put("/api/dashboard/layout", token, custom);
        assertThat(saved.getStatusCode()).isEqualTo(HttpStatus.OK);

        var reloaded = get("/api/dashboard/layout", token);
        var widgets = (List<Map<String, Object>>) reloaded.getBody().get("widgets");
        assertThat(widgets).hasSize(1);
        assertThat(widgets.getFirst()).containsEntry("id", "w1");
        // opaque storage: unknown config keys survive untouched
        assertThat((Map<String, Object>) widgets.getFirst().get("config"))
                .containsEntry("arbitrary", Map.of("deep", true));
    }

    @Test
    void seriesAndLatestEndpointsWorkAgainstRealSql() {
        String token = adminToken();

        // exercises the date_bin + interval-cast native queries against real Postgres
        var hostSeries = getList("/api/sources/host:cpu_pct/series?range=6h&bucket=5m", token);
        assertThat(hostSeries.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(hostSeries.getBody()).isEmpty();

        var healthSeries = getList("/api/sources/health:moneytrckr:prod/series?range=7d&bucket=1h",
                token);
        assertThat(healthSeries.getStatusCode()).isEqualTo(HttpStatus.OK);

        var latencySeries = getList("/api/sources/latency:moneytrckr:prod/series", token);
        assertThat(latencySeries.getStatusCode()).isEqualTo(HttpStatus.OK);

        var containerSeries = getList("/api/sources/container:portal-db:mem_bytes/series", token);
        assertThat(containerSeries.getStatusCode()).isEqualTo(HttpStatus.OK);

        // no data yet → 404 (per contract: latest always answers {ts,value} or 404)
        assertThat(get("/api/sources/host:cpu_pct/latest", token).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(get("/api/sources/not-a-source/latest", token).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(get("/api/apps/no-such-app", token).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void registryCrudRoundTrips() {
        String token = adminToken();

        var upsert = put("/api/registry/moneytrckr", token, Map.of(
                "displayName", "MoneyTrckr", "icon", "wallet", "visible", true));
        assertThat(upsert.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(upsert.getBody()).containsEntry("displayName", "MoneyTrckr");

        var list = getList("/api/registry", token);
        assertThat(list.getBody()).anyMatch(o -> "moneytrckr".equals(o.get("app")));

        var deleted = exchange(org.springframework.http.HttpMethod.DELETE,
                "/api/registry/moneytrckr", token, null);
        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }
}
