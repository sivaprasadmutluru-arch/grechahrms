package com.example.demo.carr.dto;

import com.example.demo.carr.dto.CarrDtos.*;
import com.example.demo.carr.service.CarrJobTitleCatalog;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

public final class CarrCreationDtos {
    private CarrCreationDtos() {}
    public record EmployeeOption(Long id,String fullName,String badgeId,Long departmentId,String departmentName,
                                 String jobPositionName,Long reportingManagerId,String reportingManagerName,
                                 LocalDate dateJoining,LocalDate probationEndsOn,boolean probationCovered) {}
    public record DepartmentOption(Long id,String name) {}
    public record Context(Long companyId,boolean canManage,Long employeeId,List<EmployeeOption> employees,
                          List<DepartmentOption> departments,List<CarrJobTitleCatalog.Entry> jobTitles,String reviewFrequency) {}
    public record RoleDefinition(@NotBlank @Size(max=180) String title,Long departmentId,
                                 @Size(max=10000) String purpose,@Size(max=180) String industry,@Size(max=100) String roleLevel,
                                 @Size(max=180) String reportsToTitle,@Size(max=4000) String responsibleFor,
                                 LocalDate effectiveFrom,LocalDate effectiveTo,LocalDate nextReviewDate,
                                 Boolean rewardsEnabled,Boolean rewardsVisibleToEmployee,
                                 @NotNull @Size(max=50) @Valid List<ResponsibilityRequest> responsibilities,
                                 @NotNull @Size(max=50) @Valid List<KpiRequest> kpis,
                                 @NotNull @Size(max=30) @Valid List<RewardRequest> rewards) {}
    public record RoleDraft(Long id,String title,int version,RoleDefinition definition) {}
    public record RoleSuggestion(@NotBlank @Size(max=180) String title,@NotEmpty @Size(max=20) List<@NotBlank @Size(max=500) String> responsibilities,
                                 @NotNull LocalDate effectiveFrom,@NotNull LocalDate effectiveTo) {}
}
