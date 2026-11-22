package com.example.demo.attendance.service;

import com.example.demo.attendance.entity.AttendanceRegularisationRequest;
import com.example.demo.auth.entity.User;
import com.example.demo.auth.entity.UserRole;
import com.example.demo.auth.repository.UserRoleRepository;
import com.example.demo.base.entity.Company;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.service.ReportingManagerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class ReportingManagerNotificationTest {
    @Mock UserRoleRepository userRoleRepository;
    @Mock ReportingManagerService reportingManagers;
    @InjectMocks AttendanceRegularisationService service;
    Company company;
    Employee employee, manager;
    User user;
    AttendanceRegularisationRequest request;
    @BeforeEach void setup() {
        company=new Company(); company.setId(80L);
        employee=new Employee(); employee.setId(6L); employee.setCompany(company);
        user=new User(); user.setId(260L); user.setActive(true);
        manager=new Employee(); manager.setId(2L); manager.setCompany(company); manager.setUser(user); manager.setActive(true);
        request=new AttendanceRegularisationRequest(); request.setCompany(company);
        when(userRoleRepository.findByCompanyIdAndRoleName(any(),any())).thenReturn(List.of());
        when(reportingManagers.resolve(employee)).thenReturn(manager);
    }
    @Test void employeeRoleManagerReceivesRequestWithoutAdminRole() {
        assertThat(service.notificationRecipients(request,employee)).containsExactly(260L);
    }
    @Test void managerAlsoAdminReceivesOnlyOneNotification() {
        var role=new UserRole();role.setUser(user);
        when(userRoleRepository.findByCompanyIdAndRoleName(any(),any())).thenReturn(List.of(role));
        assertThat(service.notificationRecipients(request,employee)).containsExactly(260L);
    }
    @Test void inactiveManagerDoesNotReceiveRequest() {
        manager.setActive(false);
        assertThat(service.notificationRecipients(request,employee)).isEmpty();
    }
    @Test void foreignCompanyManagerDoesNotReceiveRequest() {
        var foreign=new Company();foreign.setId(81L);manager.setCompany(foreign);
        assertThat(service.notificationRecipients(request,employee)).isEmpty();
    }
    @Test void inactiveManagerLoginDoesNotReceiveRequest() {
        user.setActive(false);
        assertThat(service.notificationRecipients(request,employee)).isEmpty();
    }
    @Test void selfManagerDoesNotReceiveOwnRequest() {
        manager.setId(employee.getId());
        assertThat(service.notificationRecipients(request,employee)).isEmpty();
    }
    @Test void noManagerPreservesAdminNotification() {
        when(reportingManagers.resolve(employee)).thenReturn(null);
        var role=new UserRole();role.setUser(user);
        when(userRoleRepository.findByCompanyIdAndRoleName(any(),any())).thenReturn(List.of(role));
        assertThat(service.notificationRecipients(request,employee)).containsExactly(260L);
    }
}
