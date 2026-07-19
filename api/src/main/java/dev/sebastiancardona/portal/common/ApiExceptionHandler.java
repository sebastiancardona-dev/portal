package dev.sebastiancardona.portal.common;

import dev.sebastiancardona.portal.common.ApiExceptions.AuthFailedException;
import dev.sebastiancardona.portal.common.ApiExceptions.DomainRuleException;
import dev.sebastiancardona.portal.common.ApiExceptions.ForbiddenException;
import dev.sebastiancardona.portal.common.ApiExceptions.NotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    ProblemDetail notFound(NotFoundException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(ForbiddenException.class)
    ProblemDetail forbidden(ForbiddenException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, e.getMessage());
    }

    @ExceptionHandler(DomainRuleException.class)
    ProblemDetail domainRule(DomainRuleException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage());
    }

    @ExceptionHandler(AuthFailedException.class)
    ProblemDetail authFailed(AuthFailedException e) {
        // one message for every auth failure — no user-enumeration oracle
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, e.getMessage());
    }

    @ExceptionHandler(ApiExceptions.UpstreamException.class)
    ProblemDetail upstream(ApiExceptions.UpstreamException e) {
        return ProblemDetail.forStatusAndDetail(
                org.springframework.http.HttpStatusCode.valueOf(e.status()), e.getMessage());
    }

    @ExceptionHandler(dev.sebastiancardona.portal.logs.dql.DqlException.class)
    ProblemDetail dql(dev.sebastiancardona.portal.logs.dql.DqlException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
        // the query bar underlines the offending spot
        problem.setProperty("position", e.position());
        return problem;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail badArgument(IllegalArgumentException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail invalid(MethodArgumentNotValidException e) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setDetail("validation failed");
        problem.setProperty("errors", e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage()).toList());
        return problem;
    }
}
