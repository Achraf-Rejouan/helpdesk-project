package com.helpdesk;

import com.helpdesk.model.Category;
import com.helpdesk.model.User;
import com.helpdesk.model.UserRole;
import com.helpdesk.repository.CategoryRepository;
import com.helpdesk.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Idempotent startup seed: one admin account and the five suggested categories.
 * Nothing is created if the corresponding data already exists.
 */
@Component
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private static final List<String> DEFAULT_CATEGORIES = List.of(
            "Hardware",
            "Software",
            "Network",
            "Printer",
            "Account & Access"
    );

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminEmail;
    private final String adminPassword;

    public DataSeeder(UserRepository userRepository,
                      CategoryRepository categoryRepository,
                      PasswordEncoder passwordEncoder,
                      @Value("${app.admin.email}") String adminEmail,
                      @Value("${app.admin.password}") String adminPassword) {
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = EmailNormalizer.normalize(adminEmail);
        this.adminPassword = adminPassword;
    }

    @Override
    @Transactional
    public void run(String... args) {
        seedAdmin();
        seedCategories();
    }

    private void seedAdmin() {
        if (userRepository.existsByRole(UserRole.ADMIN)) {
            return;
        }
        if (userRepository.existsByEmail(adminEmail)) {
            log.warn("No ADMIN account exists, but {} is already used by a non-admin account. "
                    + "The admin account was not seeded.", adminEmail);
            return;
        }

        User admin = new User();
        admin.setFullName("HelpDesk Administrator");
        admin.setEmail(adminEmail);
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setRole(UserRole.ADMIN);
        admin.setEnabled(true);
        userRepository.save(admin);

        log.info("Seeded initial admin account: {}", adminEmail);
    }

    private void seedCategories() {
        if (categoryRepository.count() > 0) {
            return;
        }
        for (String name : DEFAULT_CATEGORIES) {
            Category category = new Category();
            category.setName(name);
            categoryRepository.save(category);
        }
        log.info("Seeded {} default categories.", DEFAULT_CATEGORIES.size());
    }
}
