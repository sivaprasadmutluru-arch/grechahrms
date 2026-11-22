package com.example.demo.payroll.controller;

import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.payroll.service.PayrollCapabilities;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

@RestController
@RequestMapping("/api/payroll")
@RequiredArgsConstructor
public class PayrollAccessController {
    private final EmployeeRepository employeeRepository;

    @GetMapping("/access")
    @PreAuthorize("hasAuthority('payroll:view')")
    @Transactional(readOnly = true)
    public PayrollCapabilities access(Authentication authentication) {
        var scope = AccessScopeContext.get();
        // Validate the context before touching tenant data.
        var initial = PayrollCapabilities.resolve(authentication, scope, null);
        if (initial.requiresCompanySelection()) return initial;
        Long employeeId = employeeRepository.findByUserId(scope.getUserId())
                .filter(employee -> employee.getCompany() != null
                        && Objects.equals(employee.getCompany().getId(), initial.companyId()))
                .map(employee -> employee.getId()).orElse(null);
        return PayrollCapabilities.resolve(authentication, scope, employeeId);
    }
}
