package dev.sebastiancardona.portal.releases;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * One GitHub release, cached at sync time. `app` is the pipeline app name the
 * repo maps to (re-stamped every sync, so a repo remap heals on the next run).
 */
@Entity
@Table(name = "releases")
public class Release {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String app;

    @Column(nullable = false)
    private String repo;

    @Column(nullable = false)
    private String tag;

    private String name;

    private String body;

    @Column(nullable = false)
    private boolean prerelease;

    @Column(name = "html_url")
    private String htmlUrl;

    @Column(name = "published_at")
    private Instant publishedAt;

    /** GitHub asset list, pared down to [{name,size,downloadUrl}]; null when none. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String assets;

    @Column(name = "synced_at", nullable = false)
    private Instant syncedAt;

    protected Release() {
    }

    public Release(String app, String repo, String tag) {
        this.app = app;
        this.repo = repo;
        this.tag = tag;
    }

    public Long getId() {
        return id;
    }

    public String getApp() {
        return app;
    }

    public void setApp(String app) {
        this.app = app;
    }

    public String getRepo() {
        return repo;
    }

    public String getTag() {
        return tag;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public boolean isPrerelease() {
        return prerelease;
    }

    public void setPrerelease(boolean prerelease) {
        this.prerelease = prerelease;
    }

    public String getHtmlUrl() {
        return htmlUrl;
    }

    public void setHtmlUrl(String htmlUrl) {
        this.htmlUrl = htmlUrl;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public String getAssets() {
        return assets;
    }

    public void setAssets(String assets) {
        this.assets = assets;
    }

    public Instant getSyncedAt() {
        return syncedAt;
    }

    public void setSyncedAt(Instant syncedAt) {
        this.syncedAt = syncedAt;
    }
}
