package com.example.demo.helpdesk.controller;

import com.example.demo.helpdesk.entity.Ticket;
import com.example.demo.helpdesk.entity.TicketAttachment;
import com.example.demo.helpdesk.entity.TicketComment;
import com.example.demo.helpdesk.service.HelpdeskService;
import com.example.demo.helpdesk.dto.TicketView;
import org.springframework.transaction.annotation.Transactional;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/helpdesk/tickets")
@RequiredArgsConstructor
@Tag(name = "Helpdesk")
@Transactional
public class TicketController {

    private final HelpdeskService helpdeskService;

    @GetMapping
    @PreAuthorize("hasAuthority('helpdesk:view')")
    @Operation(summary = "List all tickets (company-scoped)")
    public ResponseEntity<List<TicketView>> list() {
        return views(helpdeskService.listTickets());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('helpdesk:view')")
    @Operation(summary = "Get a ticket by ID")
    public ResponseEntity<TicketView> get(@PathVariable Long id) {
        return view(helpdeskService.getTicketById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('helpdesk:create')")
    @Operation(summary = "Create a new ticket")
    public ResponseEntity<TicketView> create(@RequestBody Ticket ticket) {
        return view(helpdeskService.createTicket(ticket));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('helpdesk:edit')")
    @Operation(summary = "Update a ticket")
    public ResponseEntity<TicketView> update(@PathVariable Long id, @RequestBody Ticket updated) {
        return view(helpdeskService.updateTicket(id, updated));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('helpdesk:delete')")
    @Operation(summary = "Soft-delete a ticket")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        helpdeskService.deleteTicket(id);
        return ResponseEntity.ok(Map.of("message", "Ticket deactivated"));
    }

    @PostMapping("/{id}/assign/{assigneeId}")
    @PreAuthorize("hasAuthority('helpdesk:edit')")
    @Operation(summary = "Assign a ticket to an employee")
    public ResponseEntity<TicketView> assign(@PathVariable Long id, @PathVariable Long assigneeId) {
        return view(helpdeskService.assignTicket(id, assigneeId));
    }

    @PostMapping("/{id}/resolve")
    @PreAuthorize("hasAuthority('helpdesk:edit')")
    @Operation(summary = "Mark a ticket as resolved")
    public ResponseEntity<TicketView> resolve(@PathVariable Long id) {
        return view(helpdeskService.resolveTicket(id));
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasAuthority('helpdesk:edit')")
    @Operation(summary = "Close a ticket")
    public ResponseEntity<TicketView> close(@PathVariable Long id) {
        return view(helpdeskService.closeTicket(id));
    }

    @PostMapping("/{id}/reopen")
    @PreAuthorize("hasAuthority('helpdesk:edit')")
    @Operation(summary = "Reopen a closed or resolved ticket")
    public ResponseEntity<TicketView> reopen(@PathVariable Long id) {
        return view(helpdeskService.reopenTicket(id));
    }

    @PostMapping("/{id}/escalate")
    @PreAuthorize("hasAuthority('helpdesk:edit')")
    @Operation(summary = "Escalate a ticket to CRITICAL if past SLA (default 48h)")
    public ResponseEntity<TicketView> escalate(@PathVariable Long id,
                                           @RequestParam(defaultValue = "48") int slaHours) {
        return view(helpdeskService.escalateTicket(id, slaHours));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAuthority('helpdesk:view')")
    @Operation(summary = "Search tickets by keyword, status, type, and priority")
    public ResponseEntity<List<TicketView>> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Ticket.TicketStatus status,
            @RequestParam(required = false) Long typeId,
            @RequestParam(required = false) Ticket.Priority priority) {
        return views(helpdeskService.searchTickets(keyword, status, typeId, priority));
    }

    @GetMapping("/by-employee/{employeeId}")
    @PreAuthorize("hasAuthority('helpdesk:view')")
    @Operation(summary = "Get tickets raised by a specific employee")
    public ResponseEntity<List<TicketView>> byEmployee(@PathVariable Long employeeId) {
        return views(helpdeskService.getTicketsByEmployee(employeeId));
    }

    @GetMapping("/by-assignee/{employeeId}")
    @PreAuthorize("hasAuthority('helpdesk:view')")
    @Operation(summary = "Get tickets assigned to a specific employee")
    public ResponseEntity<List<TicketView>> byAssignee(@PathVariable Long employeeId) {
        return views(helpdeskService.getTicketsByAssignee(employeeId));
    }

    @GetMapping("/by-department/{departmentId}")
    @PreAuthorize("hasAuthority('helpdesk:view')")
    @Operation(summary = "Get tickets raised by employees in a specific department")
    public ResponseEntity<List<TicketView>> byDepartment(@PathVariable Long departmentId) {
        return views(helpdeskService.getTicketsByDepartment(departmentId));
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAuthority('helpdesk:view')")
    @Operation(summary = "Get helpdesk dashboard statistics")
    public ResponseEntity<Map<String, Object>> dashboard() {
        return ResponseEntity.ok(helpdeskService.getDashboard());
    }

    // ─── Comments ─────────────────────────────────────────────────────────────

    @GetMapping("/{id}/comments")
    @PreAuthorize("hasAuthority('helpdesk:view')")
    @Operation(summary = "List comments for a ticket")
    public ResponseEntity<List<TicketView.Comment>> listComments(@PathVariable Long id) {
        return ResponseEntity.ok(helpdeskService.listComments(id).stream().map(TicketView.Comment::from).toList());
    }

    @PostMapping("/{id}/comments")
    @PreAuthorize("hasAuthority('helpdesk:create')")
    @Operation(summary = "Add a comment to a ticket")
    public ResponseEntity<TicketView.Comment> addComment(@PathVariable Long id,
                                                     @RequestBody Map<String, Object> body) {
        String comment = (String) body.get("comment");
        return ResponseEntity.ok(TicketView.Comment.from(helpdeskService.addComment(id, comment)));
    }

    // ─── Attachments ──────────────────────────────────────────────────────────

    @GetMapping("/{ticketId}/attachments")
    @PreAuthorize("hasAuthority('helpdesk:view')")
    @Operation(summary = "List attachments for a ticket")
    public ResponseEntity<List<TicketView.Attachment>> listAttachments(@PathVariable Long ticketId) {
        return ResponseEntity.ok(helpdeskService.listAttachments(ticketId).stream().map(TicketView.Attachment::from).toList());
    }

    @PostMapping("/{ticketId}/attachments")
    @PreAuthorize("hasAuthority('helpdesk:create')")
    @Operation(summary = "Add an attachment to a ticket")
    public ResponseEntity<TicketView.Attachment> addAttachment(@PathVariable Long ticketId,
                                                           @RequestBody TicketAttachment attachment) {
        return ResponseEntity.ok(TicketView.Attachment.from(helpdeskService.addAttachment(ticketId, attachment)));
    }

    @DeleteMapping("/attachments/{id}")
    @PreAuthorize("hasAuthority('helpdesk:delete')")
    @Operation(summary = "Delete a ticket attachment")
    public ResponseEntity<Map<String, String>> deleteAttachment(@PathVariable Long id) {
        helpdeskService.deleteAttachment(id);
        return ResponseEntity.ok(Map.of("message", "Attachment deleted"));
    }

    private static ResponseEntity<TicketView> view(Ticket ticket) {
        return ResponseEntity.ok(TicketView.from(ticket));
    }

    private static ResponseEntity<List<TicketView>> views(List<Ticket> tickets) {
        return ResponseEntity.ok(tickets.stream().map(TicketView::from).toList());
    }
}
