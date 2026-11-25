package com.helpdesk.controller;

import com.helpdesk.exception.BadRequestException;
import com.helpdesk.exception.ForbiddenException;
import com.helpdesk.exception.ResourceNotFoundException;
import com.helpdesk.model.Category;
import com.helpdesk.model.Employee;
import com.helpdesk.model.Technician;
import com.helpdesk.model.Ticket;
import com.helpdesk.model.TicketPriority;
import com.helpdesk.model.TicketStatus;
import com.helpdesk.model.User;
import com.helpdesk.model.UserRole;
import com.helpdesk.repository.CategoryRepository;
import com.helpdesk.repository.CommentRepository;
import com.helpdesk.repository.EmployeeRepository;
import com.helpdesk.repository.TechnicianRepository;
import com.helpdesk.repository.TicketRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketRepository ticketRepository;
    private final EmployeeRepository employeeRepository;
    private final TechnicianRepository technicianRepository;
    private final CategoryRepository categoryRepository;
    private final CommentRepository commentRepository;

    public TicketController(TicketRepository ticketRepository,
                            EmployeeRepository employeeRepository,
                            TechnicianRepository technicianRepository,
                            CategoryRepository categoryRepository,
                            CommentRepository commentRepository) {
        this.ticketRepository = ticketRepository;
        this.employeeRepository = employeeRepository;
        this.technicianRepository = technicianRepository;
        this.categoryRepository = categoryRepository;
        this.commentRepository = commentRepository;
    }

    @PostMapping
    public ResponseEntity<Ticket> create(@Valid @RequestBody CreateTicketRequest request,
                                         @AuthenticationPrincipal User user) {
        // The owner is always derived from the token; any client-supplied employee is ignored.
        Employee employee = employeeRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ForbiddenException("No employee profile is linked to this account"));
        Category category = categoryRepository.findById(request.category().id())
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));

        Ticket ticket = new Ticket();
        ticket.setTitle(request.title());
        ticket.setDescription(request.description());
        ticket.setPriority(request.priority());
        ticket.setCategory(category);
        ticket.setEmployee(employee);
        ticket.setTechnician(null);
        ticket.setStatus(TicketStatus.OPEN);

        return ResponseEntity.status(HttpStatus.CREATED).body(ticketRepository.save(ticket));
    }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal User user,
                                    @PageableDefault(size = 10, sort = "createdAt",
                                            direction = Sort.Direction.DESC) Pageable pageable) {
        return pageResponse(scopedTickets(user, pageable));
    }

    @GetMapping("/{id}")
    public Ticket get(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        return visibleTicket(id, user);
    }

    @PutMapping("/{id}")
    @Transactional
    public Ticket update(@PathVariable UUID id, @Valid @RequestBody UpdateTicketRequest request,
                         @AuthenticationPrincipal User user) {
        Ticket ticket = visibleTicket(id, user);
        boolean owningEmployee = isEmployee(user)
                && ticket.getEmployee().getUser().getId().equals(user.getId());

        if (!isAdmin(user) && !owningEmployee) {
            throw new ForbiddenException("Only the owning employee or an admin can update this ticket");
        }

        // Only these fields are editable here. Status and assignment have dedicated endpoints.
        if (request.title() != null) {
            ticket.setTitle(request.title());
        }
        if (request.description() != null) {
            ticket.setDescription(request.description());
        }
        if (request.priority() != null) {
            ticket.setPriority(request.priority());
        }
        if (request.category() != null) {
            Category category = categoryRepository.findById(request.category().id())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
            ticket.setCategory(category);
        }

        return ticketRepository.save(ticket);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        Ticket ticket = findTicket(id);
        commentRepository.deleteByTicketId(id); // deliberate: a deleted ticket takes its comments with it
        ticketRepository.delete(ticket);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/status")
    public Ticket updateStatus(@PathVariable UUID id, @Valid @RequestBody UpdateStatusRequest request,
                               @AuthenticationPrincipal User user) {
        Ticket ticket = findTicket(id);

        if (isTechnician(user)) {
            boolean assigned = ticket.getTechnician() != null
                    && ticket.getTechnician().getUser().getId().equals(user.getId());
            if (!assigned) {
                throw new ForbiddenException("You can only update the status of tickets assigned to you");
            }
        } else if (!isAdmin(user)) {
            throw new ForbiddenException("You cannot update ticket status");
        }

        ticket.setStatus(request.status());
        return ticketRepository.save(ticket);
    }

    @PatchMapping("/{id}/assign/{technicianId}")
    public Ticket assign(@PathVariable UUID id, @PathVariable UUID technicianId) {
        Ticket ticket = findTicket(id);
        Technician technician = technicianRepository.findById(technicianId)
                .orElseThrow(() -> new ResourceNotFoundException("Technician not found"));

        if (!Boolean.TRUE.equals(technician.getAvailability())) {
            throw new BadRequestException("Technician is not available for assignment");
        }

        ticket.setTechnician(technician);
        return ticketRepository.save(ticket);
    }

    @PatchMapping("/{id}/unassign")
    public Ticket unassign(@PathVariable UUID id) {
        Ticket ticket = findTicket(id);
        ticket.setTechnician(null);
        return ticketRepository.save(ticket);
    }

    @GetMapping("/status/{status}")
    public Map<String, Object> byStatus(@PathVariable TicketStatus status,
                                        @AuthenticationPrincipal User user,
                                        @PageableDefault(size = 10, sort = "createdAt",
                                                direction = Sort.Direction.DESC) Pageable pageable) {
        Page<Ticket> page;
        if (isAdmin(user)) {
            page = ticketRepository.findByStatus(status, pageable);
        } else if (isEmployee(user)) {
            page = ticketRepository.findByEmployeeUserIdAndStatus(user.getId(), status, pageable);
        } else {
            page = ticketRepository.findByTechnicianUserIdAndStatus(user.getId(), status, pageable);
        }
        return pageResponse(page);
    }

    @GetMapping("/priority/{priority}")
    public Map<String, Object> byPriority(@PathVariable TicketPriority priority,
                                          @AuthenticationPrincipal User user,
                                          @PageableDefault(size = 10, sort = "createdAt",
                                                  direction = Sort.Direction.DESC) Pageable pageable) {
        Page<Ticket> page;
        if (isAdmin(user)) {
            page = ticketRepository.findByPriority(priority, pageable);
        } else if (isEmployee(user)) {
            page = ticketRepository.findByEmployeeUserIdAndPriority(user.getId(), priority, pageable);
        } else {
            page = ticketRepository.findByTechnicianUserIdAndPriority(user.getId(), priority, pageable);
        }
        return pageResponse(page);
    }

    @GetMapping("/category/{categoryId}")
    public Map<String, Object> byCategory(@PathVariable UUID categoryId,
                                          @AuthenticationPrincipal User user,
                                          @PageableDefault(size = 10, sort = "createdAt",
                                                  direction = Sort.Direction.DESC) Pageable pageable) {
        if (!categoryRepository.existsById(categoryId)) {
            throw new ResourceNotFoundException("Category not found");
        }

        Page<Ticket> page;
        if (isAdmin(user)) {
            page = ticketRepository.findByCategoryId(categoryId, pageable);
        } else if (isEmployee(user)) {
            page = ticketRepository.findByEmployeeUserIdAndCategoryId(user.getId(), categoryId, pageable);
        } else {
            page = ticketRepository.findByTechnicianUserIdAndCategoryId(user.getId(), categoryId, pageable);
        }
        return pageResponse(page);
    }

    @GetMapping("/technician/{technicianId}")
    public Map<String, Object> byTechnician(@PathVariable UUID technicianId,
                                            @PageableDefault(size = 10, sort = "createdAt",
                                                    direction = Sort.Direction.DESC) Pageable pageable) {
        if (!technicianRepository.existsById(technicianId)) {
            throw new ResourceNotFoundException("Technician not found");
        }
        return pageResponse(ticketRepository.findByTechnicianId(technicianId, pageable));
    }

    @GetMapping("/employee/{employeeId}")
    public Map<String, Object> byEmployee(@PathVariable UUID employeeId,
                                          @PageableDefault(size = 10, sort = "createdAt",
                                                  direction = Sort.Direction.DESC) Pageable pageable) {
        if (!employeeRepository.existsById(employeeId)) {
            throw new ResourceNotFoundException("Employee not found");
        }
        return pageResponse(ticketRepository.findByEmployeeId(employeeId, pageable));
    }

    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam(defaultValue = "") String keyword,
                                      @AuthenticationPrincipal User user,
                                      @PageableDefault(size = 10, sort = "createdAt",
                                              direction = Sort.Direction.DESC) Pageable pageable) {
        String trimmed = keyword.trim();
        if (trimmed.isEmpty()) {
            return pageResponse(scopedTickets(user, pageable));
        }

        Page<Ticket> page;
        if (isAdmin(user)) {
            page = ticketRepository.findByTitleContainingIgnoreCase(trimmed, pageable);
        } else if (isEmployee(user)) {
            page = ticketRepository.findByEmployeeUserIdAndTitleContainingIgnoreCase(user.getId(), trimmed, pageable);
        } else {
            page = ticketRepository.findByTechnicianUserIdAndTitleContainingIgnoreCase(user.getId(), trimmed, pageable);
        }
        return pageResponse(page);
    }

    // ----- helpers ---------------------------------------------------------

    private Page<Ticket> scopedTickets(User user, Pageable pageable) {
        if (isAdmin(user)) {
            return ticketRepository.findAll(pageable);
        }
        if (isEmployee(user)) {
            return ticketRepository.findByEmployeeUserId(user.getId(), pageable);
        }
        return ticketRepository.findByTechnicianUserId(user.getId(), pageable);
    }

    /** Returns 404 when the ticket exists but is not visible to this user. */
    private Ticket visibleTicket(UUID id, User user) {
        Ticket ticket = findTicket(id);

        if (isAdmin(user)) {
            return ticket;
        }
        if (isEmployee(user) && ticket.getEmployee().getUser().getId().equals(user.getId())) {
            return ticket;
        }
        if (isTechnician(user) && ticket.getTechnician() != null
                && ticket.getTechnician().getUser().getId().equals(user.getId())) {
            return ticket;
        }
        throw new ResourceNotFoundException("Ticket not found");
    }

    private Ticket findTicket(UUID id) {
        return ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));
    }

    private boolean isAdmin(User user) {
        return user.getRole() == UserRole.ADMIN;
    }

    private boolean isEmployee(User user) {
        return user.getRole() == UserRole.EMPLOYEE;
    }

    private boolean isTechnician(User user) {
        return user.getRole() == UserRole.TECHNICIAN;
    }

    private Map<String, Object> pageResponse(Page<Ticket> page) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", page.getContent());
        body.put("page", page.getNumber());
        body.put("size", page.getSize());
        body.put("numberOfElements", page.getNumberOfElements());
        body.put("totalElements", page.getTotalElements());
        body.put("totalPages", page.getTotalPages());
        body.put("first", page.isFirst());
        body.put("last", page.isLast());
        body.put("sort", page.getSort().toString());
        return body;
    }

    public record CategoryRef(@NotNull UUID id) {
    }

    public record CreateTicketRequest(
            @NotBlank @Size(min = 5, max = 100) String title,
            @NotBlank @Size(min = 10, max = 2000) String description,
            @NotNull TicketPriority priority,
            @NotNull @Valid CategoryRef category) {
    }

    public record UpdateTicketRequest(
            @Size(min = 5, max = 100) String title,
            @Size(min = 10, max = 2000) String description,
            TicketPriority priority,
            @Valid CategoryRef category) {
    }

    public record UpdateStatusRequest(@NotNull TicketStatus status) {
    }
}
