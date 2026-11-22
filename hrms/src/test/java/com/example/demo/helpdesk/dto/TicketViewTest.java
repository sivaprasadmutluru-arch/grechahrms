package com.example.demo.helpdesk.dto;

import com.example.demo.employee.entity.Employee;
import com.example.demo.helpdesk.entity.Ticket;
import com.example.demo.helpdesk.entity.TicketComment;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class TicketViewTest {
    @Test void includesRequesterAndSubjectWithoutSerialisingPrivateHrFields() {
        var employee = new Employee();
        employee.setId(10L);
        employee.setFirstName("Arun");
        employee.setLastName("Kumar");
        employee.setPhone("971555010000");
        employee.setDateOfBirth(LocalDate.of(1990, 1, 1));
        var ticket = new Ticket();
        ticket.setId(20L);
        ticket.setTitle("Unable to check in");
        ticket.setRaisedBy(employee);

        var view = TicketView.from(ticket);
        assertEquals("Arun Kumar", view.requesterName());
        assertEquals(ticket.getTitle(), view.subject());
        var json = new ObjectMapper().findAndRegisterModules().valueToTree(view);
        assertEquals(4, json.get("raisedBy").size());
        assertFalse(json.get("raisedBy").has("phone"));
        assertFalse(json.get("raisedBy").has("dateOfBirth"));
    }

    @Test void commentsHaveNamedAuthorsAndNoNestedTicketOrEmployeePrivateData() {
        var employee = new Employee();
        employee.setId(10L);
        employee.setFirstName("Poonam");
        employee.setLastName("Dabur");
        var comment = new TicketComment();
        comment.setCommentedBy(employee);
        comment.setComment("Please try again.");
        comment.setTicket(new Ticket());
        var view = TicketView.Comment.from(comment);
        assertEquals("Poonam Dabur", view.authorName());
        var json = new ObjectMapper().findAndRegisterModules().valueToTree(view);
        assertFalse(json.has("ticket"));
        assertEquals(4, json.get("commentedBy").size());
    }
}
