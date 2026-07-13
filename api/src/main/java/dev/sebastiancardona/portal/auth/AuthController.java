package dev.sebastiancardona.portal.auth;

import dev.sebastiancardona.portal.common.ApiExceptions.AuthFailedException;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {

    private final IdentityProvider identityProvider;
    private final TokenService tokenService;

    public AuthController(IdentityProvider identityProvider, TokenService tokenService) {
        this.identityProvider = identityProvider;
        this.tokenService = tokenService;
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record TokenResponse(String accessToken, long expiresIn) {
    }

    /** No refresh tokens in v1 — the portal is admin-only until project 05 SSO. */
    @PostMapping("/login")
    TokenResponse login(@RequestBody @Validated LoginRequest request) {
        var identity = identityProvider.authenticate(request.email(), request.password())
                .orElseThrow(() -> new AuthFailedException("bad credentials"));
        return new TokenResponse(tokenService.issueAccessToken(identity),
                tokenService.expiresInSeconds());
    }
}
