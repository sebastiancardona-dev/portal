package dev.sebastiancardona.portal.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Local shadow of an ecosystem account (JIT-provisioned on first OIDC login).
 * Dashboard layouts FK this id; identity itself lives on the auth service.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String name;

    /** The auth service's user id (JWT `uid` claim); the durable link across email changes. */
    @Column(name = "auth_uid", unique = true)
    private UUID authUid;

    /** 'admin' (full) | 'viewer' (read-only) — mirrored from ecosystem claims per request. */
    @Column(nullable = false)
    private String role = "viewer";

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;

    protected User() {
    }

    public User(String email, String name, String role) {
        this.email = email;
        this.name = name;
        this.role = role;
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getName() {
        return name;
    }

    public UUID getAuthUid() {
        return authUid;
    }

    public void setAuthUid(UUID authUid) {
        this.authUid = authUid;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
