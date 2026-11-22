package com.helpdesk.controller;

import com.helpdesk.exception.ForbiddenException;
import com.helpdesk.exception.ResourceNotFoundException;
import com.helpdesk.model.Comment;
import com.helpdesk.model.Ticket;
import com.helpdesk.model.User;
import com.helpdesk.model.UserRole;
import com.helpdesk.repository.CommentRepository;
import com.helpdesk.repository.TicketRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class CommentController {

    private final CommentRepository commentRepository;
    private final TicketRepository ticketRepository;

    public CommentController(CommentRepository commentRepository, TicketRepository ticketRepository) {
        this.commentRepository = commentRepository;
        this.ticketRepository = ticketRepository;
    }

    @PostMapping("/tickets/{ticketId}/comments")
    public ResponseEntity<Comment> create(@PathVariable UUID ticketId,
                                          @Valid @RequestBody CommentRequest request,
                                          @AuthenticationPrincipal User user) {
        Ticket ticket = visibleTicket(ticketId, user);

        // Per section 8.3, admins do not comment. Non-admins reaching this point own
        // the ticket or are its assigned technician.
        if (user.getRole() == UserRole.ADMIN) {
            throw new ForbiddenException("Administrators are not allowed to comment on tickets");
        }

        Comment comment = new Comment();
        comment.setContent(request.content());
        comment.setTicket(ticket);
        comment.setAuthor(user); // author is always derived from the token

        return ResponseEntity.status(HttpStatus.CREATED).body(commentRepository.save(comment));
    }

    @GetMapping("/tickets/{ticketId}/comments")
    public List<Comment> list(@PathVariable UUID ticketId, @AuthenticationPrincipal User user) {
        visibleTicket(ticketId, user);
        return commentRepository.findByTicketIdOrderByCreatedAtDesc(ticketId);
    }

    @GetMapping("/comments/{id}")
    public Comment get(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        Comment comment = findComment(id);
        visibleTicket(comment.getTicket().getId(), user);
        return comment;
    }

    @PutMapping("/comments/{id}")
    public Comment update(@PathVariable UUID id, @Valid @RequestBody CommentRequest request,
                          @AuthenticationPrincipal User user) {
        Comment comment = findComment(id);
        requireAuthor(comment, user);
        comment.setContent(request.content());
        return commentRepository.save(comment);
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        Comment comment = findComment(id);
        requireAuthor(comment, user);
        commentRepository.delete(comment);
        return ResponseEntity.noContent().build();
    }

    private Comment findComment(UUID id) {
        return commentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));
    }

    private void requireAuthor(Comment comment, User user) {
        if (!comment.getAuthor().getId().equals(user.getId())) {
            throw new ForbiddenException("Only the comment author can change or delete this comment");
        }
    }

    /** Returns 404 when the ticket exists but is not visible to this user. */
    private Ticket visibleTicket(UUID ticketId, User user) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));

        if (user.getRole() == UserRole.ADMIN) {
            return ticket;
        }
        if (user.getRole() == UserRole.EMPLOYEE
                && ticket.getEmployee().getUser().getId().equals(user.getId())) {
            return ticket;
        }
        if (user.getRole() == UserRole.TECHNICIAN && ticket.getTechnician() != null
                && ticket.getTechnician().getUser().getId().equals(user.getId())) {
            return ticket;
        }
        throw new ResourceNotFoundException("Ticket not found");
    }

    public record CommentRequest(@NotBlank @Size(min = 2, max = 1000) String content) {
    }
}
