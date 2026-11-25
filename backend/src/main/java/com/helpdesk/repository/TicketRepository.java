package com.helpdesk.repository;

import com.helpdesk.model.Ticket;
import com.helpdesk.model.TicketPriority;
import com.helpdesk.model.TicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TicketRepository extends JpaRepository<Ticket, UUID> {

    // Unscoped filters (admin).
    Page<Ticket> findByStatus(TicketStatus status, Pageable pageable);

    Page<Ticket> findByPriority(TicketPriority priority, Pageable pageable);

    Page<Ticket> findByCategoryId(UUID categoryId, Pageable pageable);

    Page<Ticket> findByTechnicianId(UUID technicianId, Pageable pageable);

    Page<Ticket> findByEmployeeId(UUID employeeId, Pageable pageable);

    Page<Ticket> findByTitleContainingIgnoreCase(String keyword, Pageable pageable);

    // Role scope: employee sees only their own tickets.
    Page<Ticket> findByEmployeeUserId(UUID userId, Pageable pageable);

    Page<Ticket> findByEmployeeUserIdAndStatus(UUID userId, TicketStatus status, Pageable pageable);

    Page<Ticket> findByEmployeeUserIdAndPriority(UUID userId, TicketPriority priority, Pageable pageable);

    Page<Ticket> findByEmployeeUserIdAndCategoryId(UUID userId, UUID categoryId, Pageable pageable);

    Page<Ticket> findByEmployeeUserIdAndTitleContainingIgnoreCase(UUID userId, String keyword, Pageable pageable);

    // Role scope: technician sees only assigned tickets.
    Page<Ticket> findByTechnicianUserId(UUID userId, Pageable pageable);

    Page<Ticket> findByTechnicianUserIdAndStatus(UUID userId, TicketStatus status, Pageable pageable);

    Page<Ticket> findByTechnicianUserIdAndPriority(UUID userId, TicketPriority priority, Pageable pageable);

    Page<Ticket> findByTechnicianUserIdAndCategoryId(UUID userId, UUID categoryId, Pageable pageable);

    Page<Ticket> findByTechnicianUserIdAndTitleContainingIgnoreCase(UUID userId, String keyword, Pageable pageable);

    // Deletion guards.
    boolean existsByEmployeeId(UUID employeeId);

    boolean existsByTechnicianId(UUID technicianId);

    boolean existsByCategoryId(UUID categoryId);
}
