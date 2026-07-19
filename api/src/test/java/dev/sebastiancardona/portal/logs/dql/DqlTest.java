package dev.sebastiancardona.portal.logs.dql;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.sebastiancardona.portal.logs.dql.LogQlCompiler.Compiled;
import dev.sebastiancardona.portal.logs.dql.LogQlCompiler.Kind;
import java.time.Duration;
import org.junit.jupiter.api.Test;

/** The three muscle-memory patterns first (locked answers, plan/07), then edges. */
class DqlTest {

    private static final Duration RANGE = Duration.ofHours(24);

    private Compiled compile(String query) {
        return LogQlCompiler.compile(Parser.parse(query), RANGE);
    }

    // ===== pattern 1: error rate over time =====

    @Test
    void errorRateOverTime() {
        Compiled c = compile(
                "fetch logs | filter app == \"moneytrckr\" and level == \"ERROR\" "
                        + "| summarize count() by bin(1h)");
        assertThat(c.kind()).isEqualTo(Kind.SERIES);
        assertThat(c.logql()).isEqualTo(
                "sum (count_over_time({app=\"moneytrckr\", level=\"ERROR\"}[1h]))");
        assertThat(c.step()).isEqualTo(Duration.ofHours(1));
    }

    @Test
    void binPlusFieldGroupsPerStep() {
        Compiled c = compile("fetch logs | summarize count() by bin(15m), app");
        assertThat(c.logql()).isEqualTo(
                "sum by (app) (count_over_time({job=\"docker\"}[15m]))");
        assertThat(c.step()).isEqualTo(Duration.ofMinutes(15));
    }

    // ===== pattern 2: text hunting =====

    @Test
    void containsAndNegationBecomeLineFilters() {
        Compiled c = compile(
                "fetch logs | filter message contains \"timeout\" and not message contains \"expected\"");
        assertThat(c.kind()).isEqualTo(Kind.LOGS);
        assertThat(c.logql()).isEqualTo(
                "{job=\"docker\"} |= \"timeout\" != \"expected\"");
    }

    @Test
    void quotesInsideStringsStayEscaped() {
        Compiled c = compile("fetch logs | filter message contains \"say \\\"hi\\\"\"");
        assertThat(c.logql()).isEqualTo("{job=\"docker\"} |= \"say \\\"hi\\\"\"");
    }

    // ===== pattern 3: top-N =====

    @Test
    void topNoisiestApps() {
        Compiled c = compile(
                "fetch logs | filter level >= \"WARN\" | summarize count() by app | sort desc | limit 10");
        assertThat(c.kind()).isEqualTo(Kind.TOTALS);
        assertThat(c.logql()).isEqualTo(
                "topk(10, sum by (app) (count_over_time({level=~\"WARN|ERROR\"}[1d])))");
    }

    @Test
    void sortAscUsesBottomk() {
        Compiled c = compile("fetch logs | summarize count() by app | sort asc | limit 3");
        assertThat(c.logql()).startsWith("bottomk(3,");
    }

    // ===== field semantics =====

    @Test
    void unknownFieldsGoThroughJson() {
        Compiled c = compile(
                "fetch logs | filter app == \"portal\" and requestId == \"abc-123\"");
        assertThat(c.logql()).isEqualTo(
                "{app=\"portal\"} | json | requestId = `abc-123`");
    }

    @Test
    void orOnSameLabelBecomesRegexMatcher() {
        Compiled c = compile(
                "fetch logs | filter (app == \"portal\" or app == \"auth\") and level == \"ERROR\"");
        assertThat(c.logql()).isEqualTo("{app=~\"portal|auth\", level=\"ERROR\"}");
    }

    @Test
    void labelNotEqualsStaysInSelector() {
        Compiled c = compile("fetch logs | filter env != \"test\"");
        assertThat(c.logql()).isEqualTo("{env!=\"test\", job=\"docker\"}");
    }

    @Test
    void logsSortAscMeansForward() {
        assertThat(compile("fetch logs | sort asc").forward()).isTrue();
        assertThat(compile("fetch logs").forward()).isFalse();
    }

    @Test
    void regexCharactersInOrValuesAreEscaped() {
        Compiled c = compile("fetch logs | filter app == \"a.b\" or app == \"c+d\"");
        assertThat(c.logql()).isEqualTo("{app=~\"a\\\\.b|c\\\\+d\"}");
    }

    // ===== honest rejections =====

    @Test
    void crossFieldOrIsRejected() {
        assertThatThrownBy(() -> compile(
                "fetch logs | filter app == \"a\" or level == \"ERROR\""))
                .isInstanceOf(DqlException.class)
                .hasMessageContaining("same field");
    }

    @Test
    void messageEqualityIsRejectedWithGuidance() {
        assertThatThrownBy(() -> compile("fetch logs | filter message == \"x\""))
                .isInstanceOf(DqlException.class)
                .hasMessageContaining("contains");
    }

    @Test
    void gteOutsideLevelIsRejected() {
        assertThatThrownBy(() -> Parser.parse("fetch logs | filter app >= \"a\""))
                .isInstanceOf(DqlException.class)
                .hasMessageContaining("level only");
    }

    @Test
    void unknownStageReportsPosition() {
        assertThatThrownBy(() -> Parser.parse("fetch logs | group count()"))
                .isInstanceOf(DqlException.class)
                .hasMessageContaining("unknown stage")
                .extracting(e -> ((DqlException) e).position())
                .isEqualTo(13);
    }

    @Test
    void unterminatedStringFails() {
        assertThatThrownBy(() -> Parser.parse("fetch logs | filter message contains \"oops"))
                .isInstanceOf(DqlException.class)
                .hasMessageContaining("unterminated");
    }

    @Test
    void unknownSeverityFails() {
        assertThatThrownBy(() -> compile("fetch logs | filter level >= \"LOUD\""))
                .isInstanceOf(DqlException.class)
                .hasMessageContaining("TRACE/DEBUG/INFO/WARN/ERROR");
    }

    @Test
    void filterAfterSummarizeIsRejected() {
        assertThatThrownBy(() -> compile(
                "fetch logs | summarize count() by app | filter app == \"x\""))
                .isInstanceOf(DqlException.class)
                .hasMessageContaining("before summarize");
    }

    @Test
    void limitBoundsAreEnforced() {
        assertThatThrownBy(() -> Parser.parse("fetch logs | limit 0"))
                .isInstanceOf(DqlException.class);
        assertThatThrownBy(() -> Parser.parse("fetch logs | limit 999999"))
                .isInstanceOf(DqlException.class);
    }
}
