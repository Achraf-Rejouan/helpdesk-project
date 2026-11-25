package com.helpdesk.exception;

/** Authenticated user lacks permission for this operation. */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
