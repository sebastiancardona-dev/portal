package dev.sebastiancardona.portal.logs.dql;

import java.time.Duration;
import java.util.List;

/**
 * The mini query language (project 07) — a DQL-inspired grammar that compiles
 * to LogQL. AST shapes live here as records; {@link Parser} builds them,
 * {@link LogQlCompiler} lowers them.
 *
 * <pre>
 * query      := "fetch" "logs" stage*
 * stage      := "|" (filter | summarize | sort | limit)
 * filter     := "filter" orExpr
 * orExpr     := andExpr ("or" andExpr)*
 * andExpr    := primary ("and" primary)*
 * primary    := "(" orExpr ")" | "not"? comparison
 * comparison := IDENT ("==" | "!=" | ">=") value | IDENT "contains" STRING
 * summarize  := "summarize" "count" "(" ")" ("by" byItem ("," byItem)*)?
 * byItem     := "bin" "(" DURATION ")" | IDENT
 * sort       := "sort" ("asc" | "desc")
 * limit      := "limit" NUMBER
 * </pre>
 *
 * Field semantics: {@code app}, {@code env}, {@code level}, {@code container}
 * are indexed labels; {@code message} is the log line; any other identifier is
 * a JSON field of the structured log contract. {@code >=} exists for
 * {@code level} only (severity ordering).
 */
public final class Dql {

    public sealed interface Expr permits And, Or, Comparison {}

    public record And(List<Expr> terms) implements Expr {}

    public record Or(List<Expr> terms) implements Expr {}

    public enum Op { EQ, NEQ, GTE, CONTAINS, NOT_CONTAINS }

    public record Comparison(String field, Op op, String value) implements Expr {}

    public sealed interface Stage permits Filter, Summarize, Sort, Limit {}

    public record Filter(Expr expr) implements Stage {}

    /** v1 aggregation is count() only; by-items are a time bin and/or fields. */
    public record Summarize(Duration bin, List<String> byFields) implements Stage {}

    public record Sort(boolean descending) implements Stage {}

    public record Limit(int n) implements Stage {}

    public record Query(List<Stage> stages) {}

    private Dql() {}
}
