package com.example.demo.helpdesk.dto;

import com.example.demo.employee.entity.Employee;
import com.example.demo.helpdesk.entity.Ticket;
import com.example.demo.helpdesk.entity.TicketComment;
import com.example.demo.helpdesk.entity.TicketAttachment;
import java.time.LocalDateTime;
import java.util.stream.Stream;
import java.util.stream.Collectors;

/** Explicit support payload: identify participants without serialising their full HR records. */
public record TicketView(Long id, String title, String subject, String description, String status, String priority,
                         String requesterName, Person raisedBy, Person assignedTo, Company company,
                         String category, LocalDateTime createdAt, LocalDateTime updatedAt) {
    public static TicketView from(Ticket ticket) {
        Person requester = person(ticket.getRaisedBy());
        var company = ticket.getCompany();
        return new TicketView(ticket.getId(), ticket.getTitle(), ticket.getTitle(), ticket.getDescription(),
                ticket.getStatus() == null ? "OPEN" : ticket.getStatus().name(),
                ticket.getPriority() == null ? "MEDIUM" : ticket.getPriority().name(),
                requester == null ? "Requester unavailable" : requester.fullName(),
                requester, person(ticket.getAssignedTo()),
                company == null ? null : new Company(company.getId(), company.getName()),
                ticket.getTicketType() == null ? null : ticket.getTicketType().getName(),
                ticket.getCreatedAt(), ticket.getUpdatedAt());
    }

    private static Person person(Employee employee) {
        if (employee == null) return null;
        String name = Stream.of(employee.getFirstName(), employee.getLastName())
                .filter(value -> value != null && !value.isBlank()).map(String::strip).collect(Collectors.joining(" "));
        if (name.isBlank()) name = "Employee #" + employee.getId();
        return new Person(employee.getId(), employee.getFirstName(), employee.getLastName(), name);
    }

    public record Person(Long id, String firstName, String lastName, String fullName) {}
    public record Company(Long id, String name) {}
    public record Comment(Long id, String comment, String authorName, Person commentedBy, LocalDateTime createdAt) {
        public static Comment from(TicketComment comment) {
            Person author = person(comment.getCommentedBy());
            return new Comment(comment.getId(), comment.getComment(),
                    author == null ? "Author unavailable" : author.fullName(), author, comment.getCreatedAt());
        }
    }
    public record Attachment(Long id, String fileName, String filePath, Long fileSize, LocalDateTime createdAt) {
        public static Attachment from(TicketAttachment attachment) {
            return new Attachment(attachment.getId(), attachment.getFileName(), attachment.getFilePath(),
                    attachment.getFileSize(), attachment.getCreatedAt());
        }
    }
}
