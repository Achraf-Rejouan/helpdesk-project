package com.helpdesk.repository;

import com.helpdesk.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface CommentRepository extends JpaRepository<Comment, UUID> {

    List<Comment> findByTicketIdOrderByCreatedAtDesc(UUID ticketId);

    boolean existsByAuthorId(UUID authorId);

    /** Used when a ticket is deliberately deleted together with its comments. */
    @Modifying
    @Transactional
    @Query("delete from Comment c where c.ticket.id = :ticketId")
    int deleteByTicketId(@Param("ticketId") UUID ticketId);
}
