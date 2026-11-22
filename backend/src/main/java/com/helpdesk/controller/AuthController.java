package com.helpdesk.controller;

import com.helpdesk.EmailNormalizer;
import com.helpdesk.exception.ConflictException;
import com.helpdesk.exception.UnauthorizedException;
import com.helpdesk.model.Employee;
import com.helpdesk.model.Technician;
import com.helpdesk.model.User;
import com.helpdesk.model.UserRole;
import com.helpdesk.repository.EmployeeRepository;
import com.helpdesk.repository.TechnicianRepository;
import com.helpdesk.repository.UserRepository;
import com.helpdesk.security.JwtTokenProvider;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final TechnicianRepository technicianRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public AuthController(UserRepository userRepository,
                          EmployeeRepository employeeRepository,
                          TechnicianRepository technicianRepository,
                          PasswordEncoder passwordEncoder,
                          JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.employeeRepository = employeeRepository;
        this.technicianRepository = technicianRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterRequest request) {
        String email = EmailNormalizer.normalize(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("Email is already registered");
        }

        User user = new User();
        user.setFullName(request.fullName());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(UserRole.EMPLOYEE); // never taken from the request
        user.setEnabled(true);
        userRepository.save(user);

        Employee employee = new Employee();
        employee.setDepartment(request.department());
        employee.setPhone(request.phone());
        employee.setUser(user);
        employeeRepository.save(employee);

        Map<String, Object> body = safeUser(user);
        body.put("employee", employeeProfile(employee));
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest request) {
        User user = userRepository.findByEmail(EmailNormalizer.normalize(request.email()))
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        if (!Boolean.TRUE.equals(user.getEnabled())) {
            throw new UnauthorizedException("Account is disabled");
        }
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new UnauthorizedException("Invalid email or password");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("token", tokenProvider.generateToken(user));
        body.put("tokenType", "Bearer");
        body.put("expiresIn", tokenProvider.getExpirationSeconds());
        body.put("user", loginUser(user));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal User user) {
        Map<String, Object> body = safeUser(user);

        employeeRepository.findByUserId(user.getId())
                .ifPresent(employee -> body.put("employee", employeeProfile(employee)));
        technicianRepository.findByUserId(user.getId())
                .ifPresent(technician -> body.put("technician", technicianProfile(technician)));

        return body;
    }

    private Map<String, Object> loginUser(User user) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", user.getId());
        body.put("fullName", user.getFullName());
        body.put("email", user.getEmail());
        body.put("role", user.getRole().name());
        return body;
    }

    private Map<String, Object> safeUser(User user) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", user.getId());
        body.put("fullName", user.getFullName());
        body.put("email", user.getEmail());
        body.put("role", user.getRole().name());
        body.put("enabled", user.getEnabled());
        body.put("createdAt", user.getCreatedAt());
        return body;
    }

    private Map<String, Object> employeeProfile(Employee employee) {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", employee.getId());
        profile.put("department", employee.getDepartment());
        profile.put("phone", employee.getPhone());
        return profile;
    }

    private Map<String, Object> technicianProfile(Technician technician) {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", technician.getId());
        profile.put("specialization", technician.getSpecialization());
        profile.put("availability", technician.getAvailability());
        return profile;
    }

    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 100) String fullName,
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(min = 2, max = 100) String department,
            @Size(max = 30) String phone) {
    }

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password) {
    }
}
