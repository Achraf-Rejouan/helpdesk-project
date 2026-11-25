package com.helpdesk;

import java.util.Locale;

/**
 * Emails are stored and compared in one canonical form so that registration,
 * login, and uniqueness checks are effectively case-insensitive.
 */
public final class EmailNormalizer {

    private EmailNormalizer() {
    }

    public static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
