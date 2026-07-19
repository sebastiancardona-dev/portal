package dev.sebastiancardona.portal.logs.dql;

import java.util.ArrayList;
import java.util.List;

/** Hand-rolled tokenizer — the grammar is small enough that a generator would obscure it. */
final class Lexer {

    enum Type { IDENT, STRING, NUMBER, DURATION, PIPE, LPAREN, RPAREN, COMMA, OP, EOF }

    record Token(Type type, String text, int position) {}

    private final String source;
    private int index;

    Lexer(String source) {
        this.source = source;
    }

    List<Token> tokenize() {
        List<Token> tokens = new ArrayList<>();
        while (true) {
            skipWhitespace();
            int start = index;
            if (index >= source.length()) {
                tokens.add(new Token(Type.EOF, "", start));
                return tokens;
            }
            char c = source.charAt(index);
            if (c == '|') {
                index++;
                tokens.add(new Token(Type.PIPE, "|", start));
            } else if (c == '(') {
                index++;
                tokens.add(new Token(Type.LPAREN, "(", start));
            } else if (c == ')') {
                index++;
                tokens.add(new Token(Type.RPAREN, ")", start));
            } else if (c == ',') {
                index++;
                tokens.add(new Token(Type.COMMA, ",", start));
            } else if (c == '"') {
                tokens.add(new Token(Type.STRING, readString(), start));
            } else if (c == '=' || c == '!' || c == '>') {
                tokens.add(new Token(Type.OP, readOperator(), start));
            } else if (Character.isDigit(c)) {
                tokens.add(readNumberOrDuration(start));
            } else if (Character.isLetter(c) || c == '_') {
                tokens.add(new Token(Type.IDENT, readIdent(), start));
            } else {
                throw new DqlException("unexpected character '" + c + "'", start);
            }
        }
    }

    private void skipWhitespace() {
        while (index < source.length() && Character.isWhitespace(source.charAt(index))) {
            index++;
        }
    }

    private String readString() {
        int start = index;
        index++; // opening quote
        StringBuilder out = new StringBuilder();
        while (index < source.length()) {
            char c = source.charAt(index);
            if (c == '\\' && index + 1 < source.length()) {
                out.append(source.charAt(index + 1));
                index += 2;
            } else if (c == '"') {
                index++;
                return out.toString();
            } else {
                out.append(c);
                index++;
            }
        }
        throw new DqlException("unterminated string", start);
    }

    private String readOperator() {
        int start = index;
        char c = source.charAt(index);
        if (index + 1 < source.length() && source.charAt(index + 1) == '=') {
            index += 2;
            return c + "=";
        }
        throw new DqlException("unknown operator '" + c + "' — expected ==, != or >=", start);
    }

    private Token readNumberOrDuration(int start) {
        while (index < source.length() && Character.isDigit(source.charAt(index))) {
            index++;
        }
        // a trailing unit letter makes it a duration: 15m, 1h, 30s, 7d
        if (index < source.length() && "smhd".indexOf(source.charAt(index)) >= 0) {
            index++;
            return new Token(Type.DURATION, source.substring(start, index), start);
        }
        return new Token(Type.NUMBER, source.substring(start, index), start);
    }

    private String readIdent() {
        int start = index;
        while (index < source.length()
                && (Character.isLetterOrDigit(source.charAt(index)) || source.charAt(index) == '_')) {
            index++;
        }
        return source.substring(start, index);
    }
}
