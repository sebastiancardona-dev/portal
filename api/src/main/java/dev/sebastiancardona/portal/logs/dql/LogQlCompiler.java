package dev.sebastiancardona.portal.logs.dql;

import dev.sebastiancardona.portal.logs.dql.Dql.And;
import dev.sebastiancardona.portal.logs.dql.Dql.Comparison;
import dev.sebastiancardona.portal.logs.dql.Dql.Expr;
import dev.sebastiancardona.portal.logs.dql.Dql.Filter;
import dev.sebastiancardona.portal.logs.dql.Dql.Limit;
import dev.sebastiancardona.portal.logs.dql.Dql.Op;
import dev.sebastiancardona.portal.logs.dql.Dql.Or;
import dev.sebastiancardona.portal.logs.dql.Dql.Query;
import dev.sebastiancardona.portal.logs.dql.Dql.Sort;
import dev.sebastiancardona.portal.logs.dql.Dql.Stage;
import dev.sebastiancardona.portal.logs.dql.Dql.Summarize;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Lowers a parsed DQL query to LogQL. Semantics:
 * <ul>
 *   <li>{@code app}, {@code env}, {@code level}, {@code container} are stream
 *       labels (indexed — they go into the selector);</li>
 *   <li>{@code message} is the log line (contains → line filters);</li>
 *   <li>any other field is a JSON field of the log contract (adds a
 *       {@code | json} stage and a label filter after it);</li>
 *   <li>{@code or} is supported between {@code ==} conditions on the same
 *       label (compiles to a regex matcher) — general disjunctions have no
 *       clean LogQL shape and are rejected honestly;</li>
 *   <li>{@code level >= "WARN"} expands the severity ladder to a regex.</li>
 * </ul>
 * No summarize → a log query. summarize by bin → a range metric query
 * (step = bin). summarize without bin → totals over the whole range
 * (count_over_time at the range duration); sort+limit become topk/bottomk.
 */
public final class LogQlCompiler {

    public enum Kind { LOGS, SERIES, TOTALS }

    /** step is set for SERIES; limit/forward drive the logs API call. */
    public record Compiled(Kind kind, String logql, Duration step, Integer limit, boolean forward) {}

    private static final Set<String> LABELS = Set.of("app", "env", "level", "container");
    private static final List<String> SEVERITIES = List.of("TRACE", "DEBUG", "INFO", "WARN", "ERROR");

    private LogQlCompiler() {}

    /** Accumulates the pieces of the stream selector + pipeline while walking filters. */
    private static final class State {
        final Map<String, List<String>> eqMatchers = new LinkedHashMap<>();
        final List<String> rawMatchers = new ArrayList<>();
        final List<String> lineFilters = new ArrayList<>();
        final List<String> jsonFilters = new ArrayList<>();
        /** true once any matcher exists that cannot match the empty string —
         *  LogQL rejects selectors made purely of negations. */
        boolean hasPositiveMatcher;
    }

    public static Compiled compile(Query query, Duration range) {
        State state = new State();
        Summarize summarize = null;
        Boolean sortDescending = null;
        Integer limit = null;

        for (Stage stage : query.stages()) {
            switch (stage) {
                case Filter f -> {
                    if (summarize != null) {
                        throw new DqlException("filter must come before summarize", 0);
                    }
                    for (Expr term : conjunction(f.expr())) {
                        compileTerm(term, state);
                    }
                }
                case Summarize s -> {
                    if (summarize != null) {
                        throw new DqlException("only one summarize allowed", 0);
                    }
                    summarize = s;
                }
                case Sort s -> sortDescending = s.descending();
                case Limit l -> limit = l.n();
            }
        }

        String logExpr = selector(state)
                + String.join("", state.lineFilters)
                + (state.jsonFilters.isEmpty() ? "" : " | json" + String.join("", state.jsonFilters));

        if (summarize == null) {
            return new Compiled(Kind.LOGS, logExpr, null, limit,
                    sortDescending != null && !sortDescending);
        }

        boolean binned = summarize.bin() != null;
        String by = summarize.byFields().isEmpty()
                ? "" : " by (" + String.join(", ", summarize.byFields()) + ")";
        String window = logql(binned ? summarize.bin() : range);
        String metric = "sum" + by + " (count_over_time(" + logExpr + "[" + window + "]))";
        if (limit != null && !summarize.byFields().isEmpty()) {
            // per-group ranking: sort direction picks the end of the leaderboard
            metric = (sortDescending == null || sortDescending ? "topk(" : "bottomk(")
                    + limit + ", " + metric + ")";
        }
        return new Compiled(binned ? Kind.SERIES : Kind.TOTALS, metric,
                binned ? summarize.bin() : null, limit, false);
    }

    // ===== filter lowering =====

    /** Top-level AND-flattening; nested general ORs are rejected here. */
    private static List<Expr> conjunction(Expr expr) {
        if (expr instanceof And and) {
            List<Expr> out = new ArrayList<>();
            for (Expr term : and.terms()) {
                out.addAll(conjunction(term));
            }
            return out;
        }
        return List.of(expr);
    }

    private static void compileTerm(Expr term, State state) {
        if (term instanceof Or or) {
            compileOr(or, state);
            return;
        }
        if (!(term instanceof Comparison c)) {
            throw new DqlException("unsupported expression", 0);
        }
        if (c.field().equals("message")) {
            switch (c.op()) {
                case CONTAINS -> state.lineFilters.add(" |= \"" + escapeQuotes(c.value()) + "\"");
                case NOT_CONTAINS -> state.lineFilters.add(" != \"" + escapeQuotes(c.value()) + "\"");
                default -> throw new DqlException(
                        "message supports contains / not contains (there is no exact-line match)", 0);
            }
            return;
        }
        if (LABELS.contains(c.field())) {
            // regexes inside double-quoted matchers need their backslashes doubled
            // (LogQL strings are Go strings); backtick contexts below stay raw
            switch (c.op()) {
                case EQ -> {
                    state.eqMatchers.computeIfAbsent(c.field(), k -> new ArrayList<>()).add(c.value());
                    state.hasPositiveMatcher = true;
                }
                case NEQ -> state.rawMatchers.add(c.field() + "!=\"" + escapeQuotes(c.value()) + "\"");
                case GTE -> {
                    state.rawMatchers.add("level=~\"" + severityRegex(c.value()) + "\"");
                    state.hasPositiveMatcher = true;
                }
                case CONTAINS -> {
                    state.rawMatchers.add(
                            c.field() + "=~\"" + escapeQuotes(regexContains(c.value())) + "\"");
                    state.hasPositiveMatcher = true;
                }
                case NOT_CONTAINS -> state.rawMatchers.add(
                        c.field() + "!~\"" + escapeQuotes(regexContains(c.value())) + "\"");
            }
            return;
        }
        // JSON field of the structured contract
        switch (c.op()) {
            case EQ -> state.jsonFilters.add(" | " + c.field() + " = `" + c.value() + "`");
            case NEQ -> state.jsonFilters.add(" | " + c.field() + " != `" + c.value() + "`");
            case CONTAINS -> state.jsonFilters.add(
                    " | " + c.field() + " =~ `" + regexContains(c.value()) + "`");
            case NOT_CONTAINS -> state.jsonFilters.add(
                    " | " + c.field() + " !~ `" + regexContains(c.value()) + "`");
            case GTE -> throw new DqlException(">= is supported for level only", 0);
        }
    }

    private static void compileOr(Or or, State state) {
        String field = null;
        List<String> values = new ArrayList<>();
        for (Expr term : or.terms()) {
            if (!(term instanceof Comparison c) || c.op() != Op.EQ) {
                throw new DqlException(
                        "or is supported between == conditions on the same field (v1)", 0);
            }
            if (field == null) {
                field = c.field();
            } else if (!field.equals(c.field())) {
                throw new DqlException(
                        "or is supported between == conditions on the same field (v1)", 0);
            }
            values.add(c.value());
        }
        if (!LABELS.contains(field)) {
            throw new DqlException("or is supported on label fields only (app, env, level, container)", 0);
        }
        state.eqMatchers.computeIfAbsent(field, k -> new ArrayList<>()).addAll(values);
        state.hasPositiveMatcher = true;
    }

    private static String selector(State state) {
        List<String> matchers = new ArrayList<>();
        state.eqMatchers.forEach((label, values) -> {
            if (values.size() == 1) {
                matchers.add(label + "=\"" + escapeQuotes(values.getFirst()) + "\"");
            } else {
                matchers.add(label + "=~\"" + escapeQuotes(String.join("|",
                        values.stream().map(LogQlCompiler::escapeRegex).toList())) + "\"");
            }
        });
        matchers.addAll(state.rawMatchers);
        if (!state.hasPositiveMatcher) {
            // LogQL rejects selectors that could match the empty label set —
            // Alloy stamps job=docker on every stream, so this is always true
            matchers.add("job=\"docker\"");
        }
        return "{" + String.join(", ", matchers) + "}";
    }

    // ===== helpers =====

    private static String severityRegex(String floor) {
        int from = SEVERITIES.indexOf(floor.toUpperCase());
        if (from < 0) {
            throw new DqlException("unknown level '" + floor + "' — use TRACE/DEBUG/INFO/WARN/ERROR", 0);
        }
        return String.join("|", SEVERITIES.subList(from, SEVERITIES.size()));
    }

    private static String regexContains(String value) {
        return ".*" + escapeRegex(value) + ".*";
    }

    private static String escapeRegex(String value) {
        return value.replaceAll("([.\\\\+*?\\[^\\]$(){}=!<>|:#-])", "\\\\$1");
    }

    private static String escapeQuotes(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    static String logql(Duration d) {
        if (d.toDaysPart() > 0 && d.equals(Duration.ofDays(d.toDaysPart()))) {
            return d.toDaysPart() + "d";
        }
        if (d.toHoursPart() > 0 && d.equals(Duration.ofHours(d.toHours()))) {
            return d.toHours() + "h";
        }
        if (d.toMinutes() > 0 && d.equals(Duration.ofMinutes(d.toMinutes()))) {
            return d.toMinutes() + "m";
        }
        return d.toSeconds() + "s";
    }
}
