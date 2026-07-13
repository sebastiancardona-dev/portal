package dev.sebastiancardona.portal.metrics;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface HealthCheckRepository extends JpaRepository<HealthCheck, UUID> {

    Optional<HealthCheck> findTopByAppAndEnvOrderByTsDesc(String app, String env);

    long deleteByTsBefore(Instant cutoff);
}
