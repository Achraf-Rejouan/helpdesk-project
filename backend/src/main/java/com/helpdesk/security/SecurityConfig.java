package com.helpdesk.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Stateless JWT security. Endpoint-level role rules live here; ownership and
 * finer rules are checked in the controllers.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, ObjectMapper objectMapper) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.objectMapper = objectMapper;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, authException) ->
                                SecurityErrorWriter.write(objectMapper, request, response, 401, "Unauthorized",
                                        "Authentication required or token invalid"))
                        .accessDeniedHandler((request, response, deniedException) ->
                                SecurityErrorWriter.write(objectMapper, request, response, 403, "Forbidden",
                                        "You do not have permission to access this resource")))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
                        .requestMatchers("/api/auth/me").authenticated()

                        // Comment access is refined in the controller (ticket visibility, author-only).
                        .requestMatchers("/api/tickets/*/comments", "/api/tickets/*/comments/**").authenticated()
                        .requestMatchers("/api/comments/**").authenticated()

                        // Tickets.
                        .requestMatchers(HttpMethod.POST, "/api/tickets").hasRole("EMPLOYEE")
                        .requestMatchers(HttpMethod.DELETE, "/api/tickets/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/tickets/*/assign/*", "/api/tickets/*/unassign")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/tickets/*/status").hasAnyRole("ADMIN", "TECHNICIAN")
                        .requestMatchers(HttpMethod.GET, "/api/tickets/technician/**", "/api/tickets/employee/**")
                        .hasRole("ADMIN")
                        .requestMatchers("/api/tickets/**").authenticated()

                        // Categories.
                        .requestMatchers(HttpMethod.POST, "/api/categories").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/categories/**").authenticated()

                        // Employee profile management is admin-only.
                        .requestMatchers("/api/employees/**").hasRole("ADMIN")

                        // Technician management is admin-only; a technician may read their own profile.
                        .requestMatchers(HttpMethod.POST, "/api/technicians").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/technicians/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/technicians/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/technicians/specialization").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/technicians/available").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/technicians/**").authenticated()

                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:5173", "http://localhost:3000"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
