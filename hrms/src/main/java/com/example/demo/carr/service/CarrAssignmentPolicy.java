package com.example.demo.carr.service;
import com.example.demo.employee.entity.Employee;
import com.example.demo.onboarding.repository.ProbationPolicyRepository;
import com.example.demo.onboarding.repository.ProbationConfirmationRepository;
import com.example.demo.onboarding.service.ProbationEligibility;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
@Service @RequiredArgsConstructor
public class CarrAssignmentPolicy {
    private final ProbationPolicyRepository policies;
    private final ProbationConfirmationRepository confirmations;
    private final ProbationEligibility eligibility;
    public record Dates(LocalDate joiningDate,LocalDate probationEndsOn,boolean probationCovered) {}
    public Dates forEmployee(Employee employee){
        LocalDate joining=eligibility.joiningDate(employee);
        var policy=policies.findByCompanyId(employee.getCompany().getId()).orElse(null);
        boolean covered=eligibility.applies(policy,joining)&&confirmations.findByEmployeeId(employee.getId()).isEmpty();
        // The authoritative onboarding policy currently specifies six months; do not invent a separate CAR duration.
        return new Dates(joining,covered?joining.plusMonths(6):null,covered);
    }
}
