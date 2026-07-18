package dev.sebastiancardona.portal.common;

public final class ApiExceptions {

    /** 404 — missing or not visible to the caller (avoids leaking existence). */
    public static class NotFoundException extends RuntimeException {
        public NotFoundException(String message) {
            super(message);
        }
    }

    /** 403 — authenticated but not allowed. */
    public static class ForbiddenException extends RuntimeException {
        public ForbiddenException(String message) {
            super(message);
        }
    }

    /** 422 — request understood but violates a domain rule. */
    public static class DomainRuleException extends RuntimeException {
        public DomainRuleException(String message) {
            super(message);
        }
    }

    /** 401 — bad credentials / unusable token. */
    public static class AuthFailedException extends RuntimeException {
        public AuthFailedException(String message) {
            super(message);
        }
    }

    /** Upstream service failed — relayed with its status (502 when unreachable). */
    public static class UpstreamException extends RuntimeException {
        private final int status;

        public UpstreamException(int status, String message) {
            super(message);
            this.status = status;
        }

        public int status() {
            return status;
        }
    }

    private ApiExceptions() {
    }
}
