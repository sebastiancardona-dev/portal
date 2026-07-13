package dev.sebastiancardona.portal.auth;

import dev.sebastiancardona.portal.common.ApiExceptions.AuthFailedException;
import dev.sebastiancardona.portal.common.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final UserRepository users;

    public MeController(UserRepository users) {
        this.users = users;
    }

    public record MeView(String email, String role, String name) {
    }

    @GetMapping
    MeView me(@AuthenticationPrincipal Jwt jwt) {
        User user = users.findById(CurrentUser.id(jwt))
                .orElseThrow(() -> new AuthFailedException("unknown user"));
        return new MeView(user.getEmail(), user.getRole(), user.getName());
    }
}
