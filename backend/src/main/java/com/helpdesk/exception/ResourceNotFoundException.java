package com.helpdesk.exception;

/** Requested entity does not exist (or is not visible to the current user). */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
