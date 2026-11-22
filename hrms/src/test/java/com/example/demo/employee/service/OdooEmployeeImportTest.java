package com.example.demo.employee.service;

import com.example.demo.base.entity.Company;
import com.example.demo.base.repository.*;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.common.tenant.TenantContext;
import com.example.demo.employee.dto.EmployeeRequest;
import com.example.demo.employee.dto.EmployeeResponse;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import org.junit.jupiter.api.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.mockito.ArgumentCaptor;

class OdooEmployeeImportTest {
    private static final String URL = "https://example.odoo.com";
    private final OdooEmployeeClient client = mock(OdooEmployeeClient.class);
    private final CompanyRepository companies = mock(CompanyRepository.class);
    private final EmployeeRepository employees = mock(EmployeeRepository.class);
    private final EmployeeService employeeService = mock(EmployeeService.class);
    private final ReportingManagerService managers = mock(ReportingManagerService.class);
    private final PlatformTransactionManager tx = mock(PlatformTransactionManager.class);
    private final OdooEmployeeImportService service = new OdooEmployeeImportService(client, companies,
            mock(DepartmentRepository.class), mock(JobPositionRepository.class), employees, employeeService,
            managers, new TransactionTemplate(tx));

    @BeforeEach void setup() {
        TenantContext.setTenant("target");
        AccessScopeContext.set(new AccessScopeContext.ScopeData(1L, 10L, null, List.of()));
        Company company = new Company();
        company.setId(10L);
        company.setName("Target");
        company.setSchemaName("target");
        when(companies.findById(10L)).thenReturn(Optional.of(company));
        when(tx.getTransaction(any(TransactionDefinition.class))).thenAnswer(i -> new SimpleTransactionStatus());
    }

    @AfterEach void clear() {
        TenantContext.clear();
        AccessScopeContext.clear();
    }

    @Test void previewIsReadOnlyAndCommitUsesTheReviewedRowsOnlyOnce() {
        when(client.read(URL, "", "key", 5L)).thenReturn(List.of(
                new OdooEmployeeClient.EmployeeRow(2, "Jamie Example", "Jamie@Example.com", "123", null, null, null, null)));
        var preview = service.preview(10L, URL, "", "key", 5L);
        assertTrue(preview.rows().getFirst().ready());
        verifyNoInteractions(employeeService);
        EmployeeResponse employee = new EmployeeResponse();
        employee.setId(20L);
        when(employeeService.create(any())).thenReturn(employee);

        assertEquals(1, service.commit(10L, preview.token()).imported());
        var request = ArgumentCaptor.forClass(EmployeeRequest.class);
        verify(employeeService).create(request.capture());
        assertEquals(10L, request.getValue().getCompanyId());
        assertEquals("jamie@example.com", request.getValue().getEmail());
        assertEquals("123", request.getValue().getWorkPhone());
        assertTrue(request.getValue().getPassword().length() >= 32);
        assertThrows(BadRequestException.class, () -> service.commit(10L, preview.token()));
        verify(client, times(1)).read(URL, "", "key", 5L);
    }

    @Test void existingEmployeeIsSkippedAndPreviewIsBoundToTheUser() {
        when(client.read(URL, "", "key", 5L)).thenReturn(List.of(
                new OdooEmployeeClient.EmployeeRow(2, "Existing Person", "existing@example.com", null, null, null, null, null)));
        Employee employee = new Employee();
        employee.setId(20L);
        employee.setCompany(companies.findById(10L).orElseThrow());
        when(employees.findFirstByNormalizedEmail("existing@example.com")).thenReturn(Optional.of(employee));
        var preview = service.preview(10L, URL, "", "key", 5L);
        assertFalse(preview.rows().getFirst().ready());
        AccessScopeContext.set(new AccessScopeContext.ScopeData(2L, 10L, null, List.of()));
        assertThrows(BadRequestException.class, () -> service.commit(10L, preview.token()));
        verifyNoInteractions(employeeService);
    }

    @Test void tenantMismatchStopsBeforeAnyOutboundCall() {
        TenantContext.setTenant("other");
        assertThrows(AccessDeniedException.class, () -> service.preview(10L, URL, "", "key", 5L));
        verifyNoInteractions(client, employeeService);
    }

    @Test void restrictsOutboundUrlsToOdooCloud() {
        assertEquals(URL, OdooEmployeeClient.cloudEndpoint(URL + "/").toString());
        for (String url : List.of("http://example.odoo.com", "https://127.0.0.1", "https://example.odoo.com.evil.test",
                "https://user@example.odoo.com", "https://example.odoo.com:8443", "https://example.odoo.com/unexpected")) {
            assertThrows(BadRequestException.class, () -> OdooEmployeeClient.cloudEndpoint(url), url);
        }
    }
}
