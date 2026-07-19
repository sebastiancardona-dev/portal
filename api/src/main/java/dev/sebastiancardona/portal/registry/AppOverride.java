package dev.sebastiancardona.portal.registry;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Optional display metadata for a discovered app — never required for an app to
 * show up (discovery is label/state-driven; see AppCatalog).
 */
@Entity
@Table(name = "app_overrides")
public class AppOverride {

    @Id
    private String app;

    @Column(name = "display_name")
    private String displayName;

    private String icon;

    @Column(nullable = false)
    private boolean visible = true;

    @Column(name = "health_path")
    private String healthPath;

    /** e.g. tools.sebastiancardona.dev — URL fallback when Docker discovery is absent. */
    @Column(name = "base_host")
    private String baseHost;

    /** GitHub repo when it differs from the app name (auth -> auth-service). */
    private String repo;

    protected AppOverride() {
    }

    public AppOverride(String app) {
        this.app = app;
    }

    public String getApp() {
        return app;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String icon) {
        this.icon = icon;
    }

    public boolean isVisible() {
        return visible;
    }

    public void setVisible(boolean visible) {
        this.visible = visible;
    }

    public String getHealthPath() {
        return healthPath;
    }

    public void setHealthPath(String healthPath) {
        this.healthPath = healthPath;
    }

    public String getBaseHost() {
        return baseHost;
    }

    public void setBaseHost(String baseHost) {
        this.baseHost = baseHost;
    }

    public String getRepo() {
        return repo;
    }

    public void setRepo(String repo) {
        this.repo = repo;
    }
}
