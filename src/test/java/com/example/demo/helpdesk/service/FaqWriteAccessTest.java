package com.example.demo.helpdesk.service;

import com.example.demo.base.entity.Company;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.common.exception.ResourceNotFoundException;
import com.example.demo.helpdesk.controller.HelpdeskExtrasController;
import com.example.demo.helpdesk.entity.FAQ;
import com.example.demo.helpdesk.repository.FAQRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.Arrays;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FaqWriteAccessTest {
    @Mock FaqManagementPolicy policy;
    @Mock FAQRepository faqs;
    @Mock CompanyRepository companies;
    @InjectMocks HelpdeskService service;

    @Test void directServiceWriteAlsoRejectsUnauthorisedUsers() {
        when(policy.requireCompany()).thenThrow(new AccessDeniedException("Not allowed"));
        assertThrows(AccessDeniedException.class, () -> service.createFAQ(new FAQ()));
        verifyNoInteractions(faqs);
    }

    @Test void adminCannotModifyAFaqFromAnotherCompany() {
        when(policy.requireCompany()).thenReturn(7L);
        var company = new Company();
        company.setId(8L);
        var existing = new FAQ();
        existing.setId(30L);
        existing.setCompany(company);
        when(faqs.findById(30L)).thenReturn(Optional.of(existing));
        assertThrows(ResourceNotFoundException.class, () -> service.updateFAQ(30L, new FAQ()));
        verify(faqs, never()).save(any());
    }

    @Test void creationIgnoresTheClientsCompanyAndId() {
        var selected = new Company();
        selected.setId(7L);
        var wrong = new Company();
        wrong.setId(99L);
        when(policy.requireCompany()).thenReturn(7L);
        when(companies.getReferenceById(7L)).thenReturn(selected);
        when(faqs.save(any())).thenAnswer(call -> call.getArgument(0));
        var input = new FAQ();
        input.setId(77L);
        input.setCompany(wrong);
        input.setQuestion("Where is Help?");
        input.setAnswer("Use the question-mark icon in the header.");
        var saved = service.createFAQ(input);
        assertSame(selected, saved.getCompany());
        assertNull(saved.getId());
    }

    @Test void allSixFaqMutationEndpointsUseTheStrictManagementPolicy() {
        var names = Set.of("createFAQ", "updateFAQ", "deleteFAQ",
                "createFAQCategory", "updateFAQCategory", "deleteFAQCategory");
        var methods = Arrays.stream(HelpdeskExtrasController.class.getDeclaredMethods())
                .filter(method -> names.contains(method.getName())).toList();
        assertEquals(6, methods.size());
        for (var method : methods) {
            assertEquals("@faqManagementPolicy.canManage()", method.getAnnotation(PreAuthorize.class).value());
        }
    }
}
