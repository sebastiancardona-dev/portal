package dev.sebastiancardona.portal.metrics;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.UUID;

public interface MetricPointRepository extends JpaRepository<MetricPoint, UUID> {

    long deleteByTsBefore(Instant cutoff);
}
