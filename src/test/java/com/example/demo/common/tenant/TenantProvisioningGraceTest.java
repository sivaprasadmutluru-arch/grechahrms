package com.example.demo.common.tenant;

import com.example.demo.attendance.entity.GraceTime;
import com.example.demo.attendance.repository.GraceTimeRepository;
import com.example.demo.base.entity.Company;
import com.example.demo.base.entity.Organization;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.employee.repository.EmployeeRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantProvisioningGraceTest {
    @Mock TenantProvisioningJobRepository jobs;
    @Mock CompanyRepository companies;
    @Mock EmployeeRepository employees;
    @Mock GraceTimeRepository graceTimes;
    @InjectMocks TenantProvisioningService service;
    final Organization organization = new Organization();
    final Company company = new Company();

    @BeforeEach void setup() {
        organization.setId(58L);
        company.setId(65L);
        company.setOrganization(organization);
        company.setSchemaName("new_tenant");
        company.setSchemaReady(false);
        var job = new TenantProvisioningJob();
        job.setCompany(company);
        when(jobs.findById(1L)).thenReturn(Optional.of(job));
        when(companies.findByIdPublic(65L)).thenReturn(Optional.of(company));
        TenantContext.setTenant("new_tenant");
    }

    @AfterEach void clear() { TenantContext.clear(); }

    @Test void newOrganizationGetsOneHourEvenWithoutInitialAdmin() {
        service.createInitialAdminEmployeeInTenant(1L);
        var captor = ArgumentCaptor.forClass(GraceTime.class);
        verify(graceTimes).save(captor.capture());
        var policy = captor.getValue();
        assertSame(organization, policy.getOrganization());
        assertEquals(3600, policy.getAllowedTimeInSeconds());
        assertEquals("01:00:00", policy.getAllowedTime());
        assertTrue(policy.getAllowedClockIn());
        assertTrue(policy.getAllowedClockOut());
        assertTrue(policy.getIsDefault());
        verifyNoInteractions(employees);
    }

    @Test void retryDoesNotOverwriteExistingDefault() {
        when(graceTimes.findFirstByOrganizationIdAndIsDefaultTrue(58L)).thenReturn(Optional.of(new GraceTime()));
        service.createInitialAdminEmployeeInTenant(1L);
        verify(graceTimes, never()).save(any(GraceTime.class));
    }

    @Test void existingReadyWorkspaceIsNotChanged() {
        company.setSchemaReady(true);
        service.createInitialAdminEmployeeInTenant(1L);
        verifyNoInteractions(graceTimes);
    }
}
