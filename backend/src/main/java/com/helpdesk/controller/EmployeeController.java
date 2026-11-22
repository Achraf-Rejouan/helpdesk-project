package com.helpdesk.controller;

import com.helpdesk.exception.ConflictException;
import com.helpdesk.exception.ResourceNotFoundException;
import com.helpdesk.model.Employee;
import com.helpdesk.model.User;
import com.helpdesk.repository.CommentRepository;
import com.helpdesk.repository.EmployeeRepository;
import com.helpdesk.repository.TicketRepository;
import com.helpdesk.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Employee profile management. Admin-only (enforced in SecurityConfig); an
 * employee reads their own profile through /api/auth/me.
 */
@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final TicketRepository ticketRepository;
    private final CommentRepository commentRepository;

    public EmployeeController(EmployeeRepository employeeRepository,
                              UserRepository userRepository,
                              TicketRepository ticketRepository,
                              CommentRepository commentRepository) {
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.ticketRepository = ticketRepository;
        this.commentRepository = commentRepository;
    }

    @GetMapping
    public List<Employee> list() {
        return employeeRepository.findAll();
    }

    @GetMapping("/{id}")
    public Employee get(@PathVariable UUID id) {
        return findEmployee(id);
    }

    @PutMapping("/{id}")
    @Transactional
    public Employee update(@PathVariable UUID id, @Valid @RequestBody UpdateEmployeeRequest request) {
        Employee employee = findEmployee(id);
        User user = employee.getUser();

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
        if (request.department() != null) {
            employee.setDepartment(request.department());
        }
        if (request.phone() != null) {
            employee.setPhone(request.phone());
        }

        userRepository.save(user);
        return employeeRepository.save(employee);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        Employee employee = findEmployee(id);
        User user = employee.getUser();

        if (ticketRepository.existsByEmployeeId(id)) {
            throw new ConflictException("Cannot delete employee: existing tickets reference this profile. "
                    + "Disable the account instead.");
        }
        if (commentRepository.existsByAuthorId(user.getId())) {
            throw new ConflictException("Cannot delete employee: the user has authored comments. "
                    + "Disable the account instead.");
        }

        employeeRepository.delete(employee);
        employeeRepository.flush();
        userRepository.delete(user);
        return ResponseEntity.noContent().build();
    }

    private Employee findEmployee(UUID id) {
        return employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
    }

    public record UpdateEmployeeRequest(
            @Size(min = 3, max = 100) String fullName,
            @Email @Size(min = 3, max = 255) String email,
            @Size(min = 2, max = 100) String department,
            @Size(max = 30) String phone,
            Boolean enabled) {
    }
}
