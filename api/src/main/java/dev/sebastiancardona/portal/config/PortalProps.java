package dev.sebastiancardona.portal.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Portal namespace configuration. Every external integration is optional:
 * a missing state dir, an empty docker api URL or an absent /host/proc must
 * never break the app — discovery/collectors just skip that source.
 */
@ConfigurationProperties(prefix = "portal")
public record PortalProps(Deploy deploy, Docker docker, Host host) {

    /** Pipeline (project 03) artifacts, mounted read-only in prod. */
    public record Deploy(String stateDir, String logFile) {
    }

    /** tecnativa docker-socket-proxy base URL; blank = Docker discovery disabled. */
    public record Docker(String api) {
    }

    /**
     * Host visibility. {@code proc} is the host's /proc mounted read-only.
     * {@code diskPath} is where disk usage is sampled (java.nio FileStore):
     * it deliberately defaults to the deploy-state mount, which on the VPS lives
     * on the root filesystem — so statvfs there reports root-fs usage WITHOUT
     * mounting the host root into this container (a root-fs mount would expose
     * every stack's .env secrets; least privilege wins).
     */
    public record Host(String proc, String diskPath) {
    }
}
