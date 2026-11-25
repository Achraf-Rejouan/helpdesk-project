package com.helpdesk.exception;

/** Invalid request data that Bean Validation does not cover. */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
