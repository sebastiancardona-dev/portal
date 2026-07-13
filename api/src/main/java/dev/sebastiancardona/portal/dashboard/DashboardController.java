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
     * Served when a user has no saved layout — the control-room default.
     * Row 1: host CPU / memory / prod latency stat tiles + a CPU gauge.
     * Row 2: host CPU area chart (6h) + the app status list.
     * Row 3: container-memory donut + cross-app deploy feed + container table.
     * Config keys match the widget registry (widgets/) exactly.
     */
    static final String DEFAULT_LAYOUT = """
            {"widgets":[
              {"id":"host-cpu-tile","type":"stat-tile","x":0,"y":0,"w":3,"h":2,
               "config":{"source":"host:cpu_pct","label":"Host CPU","sparkline":"on"}},
              {"id":"host-mem-tile","type":"stat-tile","x":3,"y":0,"w":3,"h":2,
               "config":{"source":"host:mem_used_bytes","label":"Host memory","sparkline":"off"}},
              {"id":"latency-tile","type":"stat-tile","x":6,"y":0,"w":3,"h":2,
               "config":{"source":"latency:moneytrckr:prod","label":"MoneyTrckr latency","sparkline":"off"}},
              {"id":"host-cpu-gauge","type":"gauge","x":9,"y":0,"w":3,"h":2,
               "config":{"source":"host:cpu_pct","warn":"80","critical":"92"}},
              {"id":"host-cpu-chart","type":"line-chart","x":0,"y":2,"w":6,"h":4,
               "config":{"source":"host:cpu_pct","kind":"area","range":"6h","bucket":"5m"}},
              {"id":"app-status","type":"status-list","x":6,"y":2,"w":6,"h":4,
               "config":{}},
              {"id":"container-mem-donut","type":"donut","x":0,"y":6,"w":4,"h":4,
               "config":{"dataset":"container-memory"}},
              {"id":"deploy-feed","type":"deploy-feed","x":4,"y":6,"w":4,"h":4,
               "config":{}},
              {"id":"container-table","type":"table","x":8,"y":6,"w":4,"h":4,
               "config":{"dataset":"containers"}}
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
