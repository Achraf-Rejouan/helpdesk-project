package com.helpdesk.exception;

/** The request conflicts with existing data (duplicate value or referenced record). */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
