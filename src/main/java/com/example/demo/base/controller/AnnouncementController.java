package com.example.demo.base.controller;

import com.example.demo.base.entity.Announcement;
import com.example.demo.base.entity.AnnouncementComment;
import com.example.demo.base.repository.AnnouncementCommentRepository;
import com.example.demo.base.repository.AnnouncementRepository;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.base.service.AnnouncementDelivery;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.common.tenant.TenantContext;
import com.example.demo.common.exception.ResourceNotFoundException;
import com.example.demo.common.util.ScopeFilter;
import com.example.demo.employee.repository.EmployeeRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/announcements")
@RequiredArgsConstructor
@Tag(name = "Announcements")
public class AnnouncementController {

    private final AnnouncementRepository announcementRepository;
    private final AnnouncementCommentRepository commentRepository;
    private final CompanyRepository companyRepository;
    private final EmployeeRepository employeeRepository;
    private final AnnouncementDelivery delivery;

    @GetMapping
    @PreAuthorize("hasAuthority('announcements:view')")
    @Transactional(readOnly = true)
    @Operation(summary = "List announcements (company-scoped)")
    public ResponseEntity<List<Announcement>> list() {
        var spec = ScopeFilter.<Announcement>byCompany();
        return ResponseEntity.ok(spec != null ? announcementRepository.findAll(spec) : announcementRepository.findAll());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PLATFORM_SUPER_ADMIN', 'ENTERPRISE_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER')")
    @Transactional
    @Operation(summary = "Create an announcement")
    public ResponseEntity<Announcement> create(@RequestBody Announcement announcement) {
        var scope = AccessScopeContext.get();
        Long companyId = scope == null ? null : scope.getFilterCompanyId() != null
                ? scope.getFilterCompanyId() : scope.getCompanyId();
        if (companyId == null) throw new BadRequestException("Select a company before publishing an announcement");
        if (scope.isSelfScope() || !scope.canAccess(companyId)
                || (announcement.getCompany() != null && announcement.getCompany().getId() != null
                    && !companyId.equals(announcement.getCompany().getId())))
            throw new org.springframework.security.access.AccessDeniedException("Announcement company does not match your selected company");
        var company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", companyId));
        var owner = company.isHeadOffice() ? company : companyRepository.findById(company.getParentCompanyId())
                .orElseThrow(() -> new BadRequestException("The selected company has no workspace"));
        if (!company.isActive() || company.getStatus() != com.example.demo.base.entity.Company.CompanyStatus.ACTIVE
                || !owner.isSchemaReady() || !TenantContext.getTenant().equals(owner.getSchemaName()))
            throw new BadRequestException("The selected company workspace is unavailable");
        if (announcement.getTitle() == null || announcement.getTitle().isBlank()
                || announcement.getTitle().trim().length() > 255 || announcement.getTitle().matches("(?s).*[\\r\\n].*"))
            throw new BadRequestException("Enter a single-line announcement title of up to 255 characters");
        var draft = new Announcement();
        draft.setTitle(announcement.getTitle().trim());
        draft.setDescription(announcement.getDescription());
        draft.setExpiresOn(announcement.getExpiresOn());
        draft.setCompany(company);
        if (scope.getUserId() != null) draft.setCreatedBy(employeeRepository.findByUserId(scope.getUserId())
                .filter(e -> e.isActive() && e.getCompany() != null && companyId.equals(e.getCompany().getId())).orElse(null));
        Announcement saved = announcementRepository.save(draft);
        delivery.publish(saved);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PLATFORM_SUPER_ADMIN', 'ENTERPRISE_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER')")
    @Transactional
    @Operation(summary = "Update an announcement")
    public ResponseEntity<Announcement> update(@PathVariable Long id, @RequestBody Announcement updated) {
        Announcement a = announcementRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Announcement", id));
        a.setTitle(updated.getTitle());
        a.setDescription(updated.getDescription());
        a.setExpiresOn(updated.getExpiresOn());
        return ResponseEntity.ok(announcementRepository.save(a));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PLATFORM_SUPER_ADMIN', 'ENTERPRISE_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER')")
    @Operation(summary = "Delete an announcement")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        announcementRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Announcement deleted"));
    }

    @GetMapping("/{id}/comments")
    @PreAuthorize("hasAuthority('announcements:view')")
    @Transactional(readOnly = true)
    @Operation(summary = "List comments for an announcement")
    public ResponseEntity<List<AnnouncementComment>> listComments(@PathVariable Long id) {
        return ResponseEntity.ok(commentRepository.findByAnnouncementId(id));
    }

    @PostMapping("/{id}/comments")
    @PreAuthorize("hasAuthority('announcements:view')")
    @Transactional
    @Operation(summary = "Add a comment to an announcement")
    public ResponseEntity<AnnouncementComment> addComment(@PathVariable Long id, @RequestBody AnnouncementComment comment) {
        comment.setAnnouncement(announcementRepository.getReferenceById(id));
        if (comment.getEmployee() != null && comment.getEmployee().getId() != null) {
            comment.setEmployee(employeeRepository.getReferenceById(comment.getEmployee().getId()));
        }
        return ResponseEntity.ok(commentRepository.save(comment));
    }

}
