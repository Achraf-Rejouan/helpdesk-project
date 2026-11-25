package com.helpdesk.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.helpdesk.model.User;
import com.helpdesk.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Reads "Authorization: Bearer &lt;jwt&gt;", validates it, and authenticates the
 * request. Missing tokens are left to the security entry point; invalid tokens
 * are rejected immediately with a JSON 401.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider,
                                   UserRepository userRepository,
                                   ObjectMapper objectMapper) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(BEARER_PREFIX.length()).trim();
        if (token.isEmpty()) {
            SecurityErrorWriter.write(objectMapper, request, response, 401, "Unauthorized",
                    "Invalid or expired token");
            return;
        }

        try {
            Claims claims = tokenProvider.parseClaims(token);
            User user = userRepository.findByEmail(claims.getSubject()).orElse(null);

            if (user == null || !Boolean.TRUE.equals(user.getEnabled())) {
                SecurityContextHolder.clearContext();
                SecurityErrorWriter.write(objectMapper, request, response, 401, "Unauthorized",
                        "Account not found or disabled");
                return;
            }

            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    user,
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);

            filterChain.doFilter(request, response);
        } catch (JwtException | IllegalArgumentException ex) {
            SecurityContextHolder.clearContext();
            SecurityErrorWriter.write(objectMapper, request, response, 401, "Unauthorized",
                    "Invalid or expired token");
        }
    }
}
