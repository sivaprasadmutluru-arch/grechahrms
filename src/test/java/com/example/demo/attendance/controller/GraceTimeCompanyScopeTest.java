package com.example.demo.attendance.controller;

import com.example.demo.attendance.entity.GraceTime;
import com.example.demo.attendance.repository.GraceTimeRepository;
import com.example.demo.base.entity.Company;
import com.example.demo.base.entity.Organization;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.common.exception.ResourceNotFoundException;
import com.example.demo.common.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GraceTimeCompanyScopeTest {
    @Mock CompanyRepository companies;
    @Mock GraceTimeRepository rules;
    @InjectMocks AttendanceSettingsController controller;
    final Company pioneer = new Company();

    @BeforeEach void setup() {
        pioneer.setId(65L);
        pioneer.setSchemaName("pioneer");
        TenantContext.setTenant("pioneer");
        AccessScopeContext.set(new AccessScopeContext.ScopeData(1L, 65L, null, List.of()));
    }

    @AfterEach void cleanup() {
        TenantContext.clear();
        AccessScopeContext.clear();
    }

    @Test void createUsesSelectedCompanyAndIgnoresSignedInAdminsOrganization() {
        when(companies.findById(65L)).thenReturn(Optional.of(pioneer));
        when(rules.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var home = new Organization();
        home.setId(11L);
        var request = new GraceTime();
        request.setOrganization(home);
        request.setAllowedTime("01:00:00");
        var saved = controller.createGraceTime(request, 65L).getBody();
        assertSame(pioneer, saved.getCompany());
        assertNull(saved.getOrganization());
        assertEquals(3600, saved.getAllowedTimeInSeconds());
    }

    @Test void staleFormTargetIsRejectedBeforeAnyWrite() {
        assertThrows(BadRequestException.class, () -> controller.createGraceTime(new GraceTime(), 5L));
        verifyNoInteractions(companies, rules);
    }

    @Test void cannotUpdateOrDeleteAnotherCompanyRuleById() {
        when(companies.findById(65L)).thenReturn(Optional.of(pioneer));
        var other = new Company();
        other.setId(5L);
        var rule = new GraceTime();
        rule.setCompany(other);
        when(rules.findById(1L)).thenReturn(Optional.of(rule));
        assertThrows(ResourceNotFoundException.class, () -> controller.updateGraceTime(1L, new GraceTime(), 65L));
        assertThrows(ResourceNotFoundException.class, () -> controller.deleteGraceTime(1L, 65L));
        verify(rules, never()).save(any());
        verify(rules, never()).delete(any(GraceTime.class));
    }
}
