package dev.sebastiancardona.portal.dashboard;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/** One saved layout per user. The layout JSON is opaque to the server. */
@Entity
@Table(name = "dashboard_layouts")
public class DashboardLayout {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String layout;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected DashboardLayout() {
    }

    public DashboardLayout(UUID userId, String layout) {
        this.userId = userId;
        this.layout = layout;
        this.updatedAt = Instant.now();
    }

    public UUID getUserId() {
        return userId;
    }

    public String getLayout() {
        return layout;
    }

    public void setLayout(String layout) {
        this.layout = layout;
        this.updatedAt = Instant.now();
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
