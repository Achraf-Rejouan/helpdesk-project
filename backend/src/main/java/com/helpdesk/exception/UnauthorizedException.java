package com.helpdesk.exception;

/** Authentication failed (bad credentials or disabled account). */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}
