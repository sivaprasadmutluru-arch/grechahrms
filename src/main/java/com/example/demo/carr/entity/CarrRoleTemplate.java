package com.example.demo.carr.entity;

import com.example.demo.base.entity.Company;
import com.example.demo.base.entity.Department;
import com.example.demo.base.entity.JobRole;
import com.example.demo.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity @Table(name = "carr_role_templates") @Getter @Setter
public class CarrRoleTemplate extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name="company_id", nullable=false)
    private Company company;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name="job_role_id")
    private JobRole jobRole;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name="department_id")
    private Department department;

    @Column(nullable=false, length=180) private String title;
    @Column(columnDefinition="text") private String purpose;
    @Column(columnDefinition="text") private String scope;
    @Column(columnDefinition="text") private String competencies;

    @Column(length=180) private String reportsToTitle;
    /** INTERNAL (for employee CARs), EXTERNAL (recruitment JD), or BOTH (dual-purpose) */
    @Column(length=30) private String targetAudience = "BOTH";
    @Column(length=50) private String employmentType;
    @Column(length=50) private String workMode;
    @Column(length=180) private String location;
    private Integer experienceMinYears;
    private Integer experienceMaxYears;
    @Column(length=120) private String educationLevel;
    @Column(columnDefinition="text") private String requiredSkills;
    @Column(columnDefinition="text") private String preferredSkills;
    @Column(precision=15, scale=2) private BigDecimal salaryMin;
    @Column(precision=15, scale=2) private BigDecimal salaryMax;
    @Column(precision=15, scale=2) private BigDecimal salaryBenchmarkMin;
    @Column(precision=15, scale=2) private BigDecimal salaryBenchmarkMedian;
    @Column(precision=15, scale=2) private BigDecimal salaryBenchmarkMax;
    @Column(length=10) private String salaryCurrency = "AED";
    @Column(length=30) private String salaryFrequency = "MONTHLY";
    @Column(nullable=false) private boolean showSalaryPublicly = false;
    @Column(columnDefinition="text") private String benefitsSummary;
    @Column(nullable=false) private int vacancyCount = 1;
    @Column(nullable=false, length=30) private String status = "ACTIVE";
    @Column(columnDefinition="text") private String applicationInstructions;

    /** Unassigned role CAR definition. Never contains employee actuals or acknowledgements. */
    @Column(name="draft_content", columnDefinition="text") private String draftContent;
    @Column(nullable=false) private int version = 1;
}
