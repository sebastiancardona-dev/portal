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
import dev.sebastiancardona.portal.logs.dql.Lexer.Token;
import dev.sebastiancardona.portal.logs.dql.Lexer.Type;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/** Recursive-descent parser for the grammar documented on {@link Dql}. */
public final class Parser {

    private final List<Token> tokens;
    private int index;

    private Parser(String source) {
        this.tokens = new Lexer(source).tokenize();
    }

    public static Query parse(String source) {
        return new Parser(source).query();
    }

    private Query query() {
        expectIdent("fetch");
        expectIdent("logs");
        List<Stage> stages = new ArrayList<>();
        while (peek().type() != Type.EOF) {
            expect(Type.PIPE, "'|'");
            stages.add(stage());
        }
        return new Query(List.copyOf(stages));
    }

    private Stage stage() {
        Token token = expect(Type.IDENT, "a stage (filter, summarize, sort, limit)");
        return switch (token.text()) {
            case "filter" -> new Filter(orExpr());
            case "summarize" -> summarize();
            case "sort" -> sort();
            case "limit" -> limit();
            default -> throw new DqlException(
                    "unknown stage '" + token.text() + "' — expected filter, summarize, sort or limit",
                    token.position());
        };
    }

    // ===== filter =====

    private Expr orExpr() {
        List<Expr> terms = new ArrayList<>();
        terms.add(andExpr());
        while (peekIdent("or")) {
            index++;
            terms.add(andExpr());
        }
        return terms.size() == 1 ? terms.getFirst() : new Or(List.copyOf(terms));
    }

    private Expr andExpr() {
        List<Expr> terms = new ArrayList<>();
        terms.add(primary());
        while (peekIdent("and")) {
            index++;
            terms.add(primary());
        }
        return terms.size() == 1 ? terms.getFirst() : new And(List.copyOf(terms));
    }

    private Expr primary() {
        if (peek().type() == Type.LPAREN) {
            index++;
            Expr inner = orExpr();
            expect(Type.RPAREN, "')'");
            return inner;
        }
        boolean negated = peekIdent("not");
        if (negated) {
            index++;
        }
        return comparison(negated);
    }

    private Expr comparison(boolean negated) {
        Token field = expect(Type.IDENT, "a field name");
        Token next = advance();
        if (next.type() == Type.IDENT && next.text().equals("contains")) {
            Token value = expect(Type.STRING, "a quoted string after contains");
            return new Comparison(field.text(),
                    negated ? Op.NOT_CONTAINS : Op.CONTAINS, value.text());
        }
        if (next.type() == Type.OP) {
            Op op = switch (next.text()) {
                case "==" -> negated ? Op.NEQ : Op.EQ;
                case "!=" -> negated ? Op.EQ : Op.NEQ;
                case ">=" -> {
                    if (negated) {
                        throw new DqlException("'not' cannot combine with >=", next.position());
                    }
                    if (!field.text().equals("level")) {
                        throw new DqlException(">= is supported for level only", next.position());
                    }
                    yield Op.GTE;
                }
                default -> throw new DqlException("unknown operator " + next.text(), next.position());
            };
            Token value = advance();
            if (value.type() != Type.STRING && value.type() != Type.NUMBER) {
                throw new DqlException("expected a value after " + next.text(), value.position());
            }
            return new Comparison(field.text(), op, value.text());
        }
        throw new DqlException("expected an operator (==, !=, >=, contains)", next.position());
    }

    // ===== summarize / sort / limit =====

    private Stage summarize() {
        Token agg = expect(Type.IDENT, "an aggregation");
        if (!agg.text().equals("count")) {
            throw new DqlException("v1 supports count() only", agg.position());
        }
        expect(Type.LPAREN, "'('");
        expect(Type.RPAREN, "')'");
        Duration bin = null;
        List<String> byFields = new ArrayList<>();
        if (peekIdent("by")) {
            index++;
            do {
                Token item = expect(Type.IDENT, "bin(...) or a field name");
                if (item.text().equals("bin")) {
                    if (bin != null) {
                        throw new DqlException("only one bin(...) allowed", item.position());
                    }
                    expect(Type.LPAREN, "'('");
                    Token duration = expect(Type.DURATION, "a duration like 1h or 15m");
                    bin = parseDuration(duration);
                    expect(Type.RPAREN, "')'");
                } else {
                    byFields.add(item.text());
                }
            } while (consumeIf(Type.COMMA));
        }
        return new Summarize(bin, List.copyOf(byFields));
    }

    private Stage sort() {
        Token dir = expect(Type.IDENT, "asc or desc");
        return switch (dir.text()) {
            case "asc" -> new Sort(false);
            case "desc" -> new Sort(true);
            default -> throw new DqlException("expected asc or desc", dir.position());
        };
    }

    private Stage limit() {
        Token n = expect(Type.NUMBER, "a number");
        int value = Integer.parseInt(n.text());
        if (value < 1 || value > 5000) {
            throw new DqlException("limit must be between 1 and 5000", n.position());
        }
        return new Limit(value);
    }

    private static Duration parseDuration(Token token) {
        String text = token.text();
        long amount = Long.parseLong(text.substring(0, text.length() - 1));
        return switch (text.charAt(text.length() - 1)) {
            case 's' -> Duration.ofSeconds(amount);
            case 'm' -> Duration.ofMinutes(amount);
            case 'h' -> Duration.ofHours(amount);
            case 'd' -> Duration.ofDays(amount);
            default -> throw new DqlException("unknown duration unit", token.position());
        };
    }

    // ===== token plumbing =====

    private Token peek() {
        return tokens.get(index);
    }

    private boolean peekIdent(String text) {
        Token token = peek();
        return token.type() == Type.IDENT && token.text().equals(text);
    }

    private Token advance() {
        Token token = tokens.get(index);
        if (token.type() != Type.EOF) {
            index++;
        }
        return token;
    }

    private Token expect(Type type, String what) {
        Token token = peek();
        if (token.type() != type) {
            throw new DqlException("expected " + what
                    + (token.type() == Type.EOF ? " but the query ended" : ""), token.position());
        }
        index++;
        return token;
    }

    private void expectIdent(String text) {
        Token token = peek();
        if (token.type() != Type.IDENT || !token.text().equals(text)) {
            throw new DqlException("expected '" + text + "'", token.position());
        }
        index++;
    }

    private boolean consumeIf(Type type) {
        if (peek().type() == type) {
            index++;
            return true;
        }
        return false;
    }
}
