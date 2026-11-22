package com.example.demo.employee.controller;

import com.example.demo.employee.service.OdooEmployeeImportService;
import com.example.demo.employee.service.OdooHistoryImportService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/employees/odoo")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('PLATFORM_SUPER_ADMIN','SUPER_ADMIN','ENTERPRISE_ADMIN','COMPANY_ADMIN','BRANCH_ADMIN','HR_MANAGER') and hasAuthority('employee:create')")
public class OdooEmployeeImportController {
    private final OdooEmployeeImportService importer;
    private final OdooHistoryImportService history;

    public record Source(@NotBlank @Size(max = 200) String url,
                         @Size(max = 100) @Pattern(regexp = "[A-Za-z0-9_.-]*") String database,
                         @NotBlank @Size(max = 256) String apiKey,
                         @Positive long sourceCompanyId) {
        @Override public String toString() { return "Odoo source (credentials redacted)"; }
    }

    public record Confirmation(@NotNull UUID previewToken) {}
    public record HistorySource(@NotNull @Valid Source source, @NotNull java.time.LocalDate from,
                                @NotNull java.time.LocalDate to) {}

    @PostMapping("/{companyId}/preview")
    public OdooEmployeeImportService.Preview preview(@PathVariable @Positive Long companyId,
                                                   @Valid @RequestBody Source source) {
        return importer.preview(companyId, source.url(), source.database(), source.apiKey(), source.sourceCompanyId());
    }

    @PostMapping("/{companyId}/import")
    public OdooEmployeeImportService.ImportResult commit(@PathVariable @Positive Long companyId,
                                                        @Valid @RequestBody Confirmation confirmation) {
        return importer.commit(companyId, confirmation.previewToken());
    }

    @PostMapping("/{companyId}/history/{kind}/preview")
    public OdooHistoryImportService.Preview previewHistory(@PathVariable Long companyId,
            @PathVariable OdooHistoryImportService.Kind kind, @Valid @RequestBody HistorySource input) {
        requireHistoryAuthority(kind);
        var source = input.source();
        return history.preview(companyId, kind, source.url(), source.database(), source.apiKey(),
                source.sourceCompanyId(), input.from(), input.to());
    }

    @PostMapping("/{companyId}/history/{kind}/import")
    public OdooHistoryImportService.Result commitHistory(@PathVariable Long companyId,
            @PathVariable OdooHistoryImportService.Kind kind, @Valid @RequestBody Confirmation input) {
        requireHistoryAuthority(kind);
        return history.commit(companyId, kind, input.previewToken());
    }

    private void requireHistoryAuthority(OdooHistoryImportService.Kind kind) {
        String authority = kind == OdooHistoryImportService.Kind.LEAVE ? "leave:approve" : "attendance:create";
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities().stream().noneMatch(a -> authority.equals(a.getAuthority())))
            throw new org.springframework.security.access.AccessDeniedException("Migration permission required");
    }
}
