package dev.sebastiancardona.portal.data;

import dev.sebastiancardona.portal.data.SourceId.Kind;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SourceIdTest {

    @Test
    void parsesHealthAndLatency() {
        SourceId health = SourceId.parse("health:moneytrckr:prod").orElseThrow();
        assertThat(health.kind()).isEqualTo(Kind.HEALTH);
        assertThat(health.app()).isEqualTo("moneytrckr");
        assertThat(health.env()).isEqualTo("prod");

        SourceId latency = SourceId.parse("latency:swiss-dev-tools:test").orElseThrow();
        assertThat(latency.kind()).isEqualTo(Kind.LATENCY);
        assertThat(latency.app()).isEqualTo("swiss-dev-tools");
    }

    @Test
    void parsesHostAndContainer() {
        SourceId host = SourceId.parse("host:cpu_pct").orElseThrow();
        assertThat(host.kind()).isEqualTo(Kind.HOST);
        assertThat(host.metric()).isEqualTo("cpu_pct");

        SourceId container = SourceId.parse("container:portal-db:mem_bytes").orElseThrow();
        assertThat(container.kind()).isEqualTo(Kind.CONTAINER);
        assertThat(container.container()).isEqualTo("portal-db");
        assertThat(container.metric()).isEqualTo("mem_bytes");
    }

    @Test
    void roundTripsBackToTheSameId() {
        for (String id : new String[]{"health:moneytrckr:prod", "latency:portal:test",
                "host:disk_used_bytes", "container:moneytrckr:cpu_pct"}) {
            assertThat(SourceId.parse(id).orElseThrow().id()).isEqualTo(id);
        }
    }

    @Test
    void rejectsMalformedIds() {
        assertThat(SourceId.parse(null)).isEmpty();
        assertThat(SourceId.parse("")).isEmpty();
        assertThat(SourceId.parse("bogus:app:prod")).isEmpty();
        assertThat(SourceId.parse("health:only-app")).isEmpty();
        assertThat(SourceId.parse("health:app:prod:extra")).isEmpty();
        assertThat(SourceId.parse("host:")).isEmpty();
        assertThat(SourceId.parse("host")).isEmpty();
        assertThat(SourceId.parse("container:name")).isEmpty();
        assertThat(SourceId.parse("health::prod")).isEmpty();
    }
}
