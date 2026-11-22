package com.helpdesk.controller;

import com.helpdesk.exception.ConflictException;
import com.helpdesk.exception.ResourceNotFoundException;
import com.helpdesk.model.Category;
import com.helpdesk.repository.CategoryRepository;
import com.helpdesk.repository.TicketRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryRepository categoryRepository;
    private final TicketRepository ticketRepository;

    public CategoryController(CategoryRepository categoryRepository, TicketRepository ticketRepository) {
        this.categoryRepository = categoryRepository;
        this.ticketRepository = ticketRepository;
    }

    @PostMapping
    public ResponseEntity<Category> create(@Valid @RequestBody CategoryRequest request) {
        if (categoryRepository.existsByNameIgnoreCase(request.name())) {
            throw new ConflictException("Category name already exists");
        }

        Category category = new Category();
        category.setName(request.name());
        category.setDescription(request.description());
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryRepository.save(category));
    }

    @GetMapping
    public List<Category> list() {
        return categoryRepository.findAll();
    }

    @GetMapping("/{id}")
    public Category get(@PathVariable UUID id) {
        return findCategory(id);
    }

    @PutMapping("/{id}")
    public Category update(@PathVariable UUID id, @Valid @RequestBody CategoryRequest request) {
        Category category = findCategory(id);

        categoryRepository.findByNameIgnoreCase(request.name()).ifPresent(existing -> {
            if (!existing.getId().equals(category.getId())) {
                throw new ConflictException("Category name already exists");
            }
        });

        category.setName(request.name());
        category.setDescription(request.description());
        return categoryRepository.save(category);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        Category category = findCategory(id);

        if (ticketRepository.existsByCategoryId(id)) {
            throw new ConflictException("Cannot delete category: tickets still use it.");
        }

        categoryRepository.delete(category);
        return ResponseEntity.noContent().build();
    }

    private Category findCategory(UUID id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
    }

    public record CategoryRequest(
            @NotBlank @Size(min = 3, max = 60) String name,
            @Size(max = 255) String description) {
    }
}
