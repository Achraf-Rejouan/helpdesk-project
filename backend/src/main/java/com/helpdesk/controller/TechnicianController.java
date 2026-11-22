package com.helpdesk.controller;

import com.helpdesk.exception.ConflictException;
import com.helpdesk.exception.ForbiddenException;
import com.helpdesk.exception.ResourceNotFoundException;
import com.helpdesk.model.Technician;
import com.helpdesk.model.User;
import com.helpdesk.model.UserRole;
import com.helpdesk.repository.CommentRepository;
import com.helpdesk.repository.TechnicianRepository;
import com.helpdesk.repository.TicketRepository;
import com.helpdesk.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/technicians")
public class TechnicianController {

    private final TechnicianRepository technicianRepository;
    private final UserRepository userRepository;
    private final TicketRepository ticketRepository;
    private final CommentRepository commentRepository;
    private final PasswordEncoder passwordEncoder;

    public TechnicianController(TechnicianRepository technicianRepository,
                                UserRepository userRepository,
                                TicketRepository ticketRepository,
                                CommentRepository commentRepository,
                                PasswordEncoder passwordEncoder) {
        this.technicianRepository = technicianRepository;
        this.userRepository = userRepository;
        this.ticketRepository = ticketRepository;
        this.commentRepository = commentRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Technician> create(@Valid @RequestBody CreateTechnicianRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email is already registered");
        }

        User user = new User();
        user.setFullName(request.fullName());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(UserRole.TECHNICIAN); // never taken from the request
        user.setEnabled(true);
        userRepository.save(user);

        Technician technician = new Technician();
        technician.setSpecialization(request.specialization());
        technician.setAvailability(request.availability());
        technician.setUser(user);

        return ResponseEntity.status(HttpStatus.CREATED).body(technicianRepository.save(technician));
    }

    @GetMapping
    public List<Technician> list() {
        return technicianRepository.findAll();
    }

    @GetMapping("/available")
    public List<Technician> available() {
        return technicianRepository.findByAvailabilityTrue();
    }

    @GetMapping("/specialization")
    public List<Technician> bySpecialization(@RequestParam String keyword) {
        return technicianRepository.findBySpecializationContainingIgnoreCase(keyword);
    }

    @GetMapping("/{id}")
    public Technician get(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        Technician technician = findTechnician(id);
        boolean isAdmin = currentUser.getRole() == UserRole.ADMIN;
        boolean isOwner = technician.getUser().getId().equals(currentUser.getId());
        if (!isAdmin && !isOwner) {
            throw new ForbiddenException("You can only view your own technician profile");
        }
        return technician;
    }

    @PutMapping("/{id}")
    @Transactional
    public Technician update(@PathVariable UUID id, @Valid @RequestBody UpdateTechnicianRequest request) {
        Technician technician = findTechnician(id);
        User user = technician.getUser();

        if (request.fullName() != null) {
            user.setFullName(request.fullName());
        }
        if (request.email() != null) {
            boolean changed = !request.email().equalsIgnoreCase(user.getEmail());
            if (changed && userRepository.existsByEmail(request.email())) {
                throw new ConflictException("Email is already registered");
            }
            user.setEmail(request.email());
        }
        if (request.enabled() != null) {
            user.setEnabled(request.enabled());
        }
        if (request.specialization() != null) {
            technician.setSpecialization(request.specialization());
        }
        if (request.availability() != null) {
            technician.setAvailability(request.availability());
        }

        userRepository.save(user);
        return technicianRepository.save(technician);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        Technician technician = findTechnician(id);
        User user = technician.getUser();

        if (ticketRepository.existsByTechnicianId(id)) {
            throw new ConflictException("Cannot delete technician: tickets are still assigned to this profile. "
                    + "Unassign or reassign those tickets first.");
        }
        if (commentRepository.existsByAuthorId(user.getId())) {
            throw new ConflictException("Cannot delete technician: the user has authored comments. "
                    + "Disable the account instead.");
        }

        technicianRepository.delete(technician);
        technicianRepository.flush();
        userRepository.delete(user);
        return ResponseEntity.noContent().build();
    }

    private Technician findTechnician(UUID id) {
        return technicianRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Technician not found"));
    }

    public record CreateTechnicianRequest(
            @NotBlank @Size(min = 3, max = 100) String fullName,
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(min = 2, max = 100) String specialization,
            @NotNull Boolean availability) {
    }

    public record UpdateTechnicianRequest(
            @Size(min = 3, max = 100) String fullName,
            @Email @Size(min = 3, max = 255) String email,
            @Size(min = 2, max = 100) String specialization,
            Boolean availability,
            Boolean enabled) {
    }
}
