package com.helpdesk.repository;

import com.helpdesk.model.Technician;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TechnicianRepository extends JpaRepository<Technician, UUID> {

    Optional<Technician> findByUserId(UUID userId);

    List<Technician> findByAvailabilityTrue();

    List<Technician> findBySpecializationContainingIgnoreCase(String keyword);
}
