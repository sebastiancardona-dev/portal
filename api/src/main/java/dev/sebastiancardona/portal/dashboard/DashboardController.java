package dev.sebastiancardona.portal.dashboard;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sebastiancardona.portal.common.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Per-user dashboard layout. The JSON is stored opaquely (jsonb) — the widget
 * schema belongs to the SPA; the server only guarantees it's valid JSON.
 */
@RestController
@RequestMapping("/api/dashboard/layout")
public class DashboardController {

    /**
     * Served when a user has no saved layout: host CPU + RAM stat tiles, host CPU
     * line chart (6h), app status list, per-container memory table (DESIGN.md).
     */
    static final String DEFAULT_LAYOUT = """
            {"widgets":[
              {"id":"host-cpu-tile","type":"stat-tile","x":0,"y":0,"w":3,"h":2,
               "config":{"source":"host:cpu_pct","label":"Host CPU","unit":"%"}},
              {"id":"host-ram-tile","type":"stat-tile","x":3,"y":0,"w":3,"h":2,
               "config":{"source":"host:mem_used_bytes","totalSource":"host:mem_total_bytes",
                         "label":"Host RAM","unit":"bytes"}},
              {"id":"host-cpu-chart","type":"line-chart","x":6,"y":0,"w":6,"h":4,
               "config":{"source":"host:cpu_pct","range":"6h","bucket":"5m",
                         "label":"Host CPU — 6h","unit":"%"}},
              {"id":"app-status","type":"status-list","x":0,"y":2,"w":6,"h":4,
               "config":{"label":"Apps"}},
              {"id":"container-mem","type":"table","x":6,"y":4,"w":6,"h":4,
               "config":{"metric":"mem_bytes","label":"Container memory"}}
            ]}""";

    private final DashboardLayoutRepository layouts;
    private final ObjectMapper mapper;

    public DashboardController(DashboardLayoutRepository layouts, ObjectMapper mapper) {
        this.layouts = layouts;
        this.mapper = mapper;
    }

    @GetMapping
    JsonNode get(@AuthenticationPrincipal Jwt jwt) throws JsonProcessingException {
        String layout = layouts.findById(CurrentUser.id(jwt))
                .map(DashboardLayout::getLayout)
                .orElse(DEFAULT_LAYOUT);
        return mapper.readTree(layout);
    }

    @PutMapping
    @Transactional
    public JsonNode put(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode body) {
        UUID userId = CurrentUser.id(jwt);
        String layout = body.toString();
        DashboardLayout saved = layouts.findById(userId)
                .map(existing -> {
                    existing.setLayout(layout);
                    return existing;
                })
                .orElseGet(() -> new DashboardLayout(userId, layout));
        layouts.save(saved);
        return body;
    }
}
