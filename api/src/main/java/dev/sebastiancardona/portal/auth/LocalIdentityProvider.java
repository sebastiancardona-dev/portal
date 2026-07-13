package dev.sebastiancardona.portal.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * v1 identity provider: one admin account from ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME,
 * argon2id-hashed into the users table at startup (seeded only when absent).
 * The portal is admin-only until project 05's OIDC replaces this class.
 */
@Service
public class LocalIdentityProvider implements IdentityProvider, CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(LocalIdentityProvider.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String adminEmail;
    private final String adminPassword;
    private final String adminName;

    public LocalIdentityProvider(UserRepository users, PasswordEncoder passwordEncoder,
                                 @Value("${portal.admin.email}") String adminEmail,
                                 @Value("${portal.admin.password}") String adminPassword,
                                 @Value("${portal.admin.name}") String adminName) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
        this.adminName = adminName;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (adminEmail.isBlank() || adminPassword.isBlank()
                || users.existsByEmailIgnoreCase(adminEmail)) {
            return;
        }
        User admin = users.save(new User(adminEmail, adminName,
                passwordEncoder.encode(adminPassword), "admin"));
        log.info("seeded admin account {}", admin.getId());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Identity> authenticate(String email, String password) {
        return users.findByEmailIgnoreCase(email)
                .filter(user -> passwordEncoder.matches(password, user.getPasswordHash()))
                .map(user -> new Identity(user.getId(), user.getEmail(), user.getRole()));
    }
}
