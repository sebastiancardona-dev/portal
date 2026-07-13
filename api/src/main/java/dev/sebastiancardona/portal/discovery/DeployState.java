package dev.sebastiancardona.portal.discovery;

import java.time.Instant;

/**
 * One `/data/deploy/state/<app>-<env>.json` file (pipeline 03 contract):
 * {"app","env","version","status","timestamp"} — latest deploy only.
 */
public record DeployState(String app, String env, String version, String status,
                          Instant timestamp) {
}
