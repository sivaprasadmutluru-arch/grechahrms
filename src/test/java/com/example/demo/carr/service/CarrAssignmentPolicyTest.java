package com.example.demo.carr.service;
import com.example.demo.base.entity.Company;
import com.example.demo.employee.entity.Employee;
import com.example.demo.onboarding.entity.ProbationPolicy;
import com.example.demo.onboarding.repository.*;
import com.example.demo.onboarding.service.ProbationEligibility;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class CarrAssignmentPolicyTest {
 @Test void usesApplicableOnboardingPeriodAndDoesNotInventOne(){
  var policies=mock(ProbationPolicyRepository.class);var confirmations=mock(ProbationConfirmationRepository.class);var eligibility=mock(ProbationEligibility.class);
  var service=new CarrAssignmentPolicy(policies,confirmations,eligibility);var e=new Employee();e.setId(1L);var company=new Company();company.setId(7L);e.setCompany(company);
  var joining=LocalDate.of(2026,8,1);var p=new ProbationPolicy();p.setEnabled(true);p.setEffectiveFrom(LocalDate.of(2026,1,1));
  when(eligibility.joiningDate(e)).thenReturn(joining);when(policies.findByCompanyId(7L)).thenReturn(Optional.of(p));when(eligibility.applies(p,joining)).thenReturn(true);
  assertEquals(LocalDate.of(2027,2,1),service.forEmployee(e).probationEndsOn());
  when(eligibility.applies(p,joining)).thenReturn(false);assertNull(service.forEmployee(e).probationEndsOn());
 }
}
