package dev.sebastiancardona.portal.auth;

import dev.sebastiancardona.portal.auth.IdentityProvider.Identity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/** Issues short-lived HS256 access JWTs. Subject = user id; claims email/role. */
@Service
public class TokenService {

    private final JwtEncoder encoder;
    private final Duration accessTtl;

    public TokenService(JwtEncoder encoder,
                        @Value("${portal.jwt.access-ttl:30m}") Duration accessTtl) {
        this.encoder = encoder;
        this.accessTtl = accessTtl;
    }

    public String issueAccessToken(Identity identity) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("portal")
                .subject(identity.id().toString())
                .issuedAt(now)
                .expiresAt(now.plus(accessTtl))
                .claim("email", identity.email())
                .claim("role", identity.role())
                .build();
        return encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    public long expiresInSeconds() {
        return accessTtl.toSeconds();
    }
}
