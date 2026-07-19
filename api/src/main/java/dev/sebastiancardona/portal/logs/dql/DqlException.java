package dev.sebastiancardona.portal.logs.dql;

/** Query error with the offset where it happened — the UI underlines it. */
public class DqlException extends RuntimeException {

    private final int position;

    public DqlException(String message, int position) {
        super(message);
        this.position = position;
    }

    public int position() {
        return position;
    }
}
