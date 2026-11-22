package com.example.demo.helpdesk.service;

import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.auth.entity.UserRole;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.base.repository.DepartmentRepository;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.common.exception.ResourceNotFoundException;
import com.example.demo.common.util.ScopeFilter;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.helpdesk.entity.*;
import com.example.demo.helpdesk.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class HelpdeskService {

    private final TicketRepository ticketRepository;
    private final TicketCommentRepository ticketCommentRepository;
    private final TicketAttachmentRepository ticketAttachmentRepository;
    private final TicketTypeRepository ticketTypeRepository;
    private final ClaimRequestRepository claimRequestRepository;
    private final FAQRepository faqRepository;
    private final FAQCategoryRepository faqCategoryRepository;
    private final DepartmentManagerRepository departmentManagerRepository;
    private final EmployeeRepository employeeRepository;
    private final CompanyRepository companyRepository;
    private final DepartmentRepository departmentRepository;
    private final FaqManagementPolicy faqManagementPolicy;

    // ─── Ticket CRUD ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Ticket> listTickets() {
        return ticketRepository.findAll(visibleTickets());
    }

    @Transactional(readOnly = true)
    public Ticket getTicketById(Long id) {
        return findTicket(id);
    }

    @Transactional
    public Ticket createTicket(Ticket ticket) {
        var scope = requireTicketScope();
        var employee = employeeRepository.findByUserId(scope.getUserId())
                .orElseThrow(() -> new AccessDeniedException("An employee profile is required to open an internal ticket"));
        var company = employee.getCompany();
        if (company == null || !scope.canAccess(company.getId())) {
            throw new AccessDeniedException("Your employee profile is outside this company");
        }
        if (ticket.getTitle() == null || ticket.getTitle().isBlank() || ticket.getTitle().length() > 255) {
            throw new BadRequestException("Enter a ticket subject of no more than 255 characters");
        }
        // An internal ticket always belongs to the requester's own employing company.
        var request = new Ticket();
        request.setCompany(company);
        request.setRaisedBy(employee);
        request.setTitle(ticket.getTitle().strip());
        request.setDescription(ticket.getDescription());
        if (ticket.getPriority() != null) request.setPriority(ticket.getPriority());
        return ticketRepository.save(request);
    }

    @Transactional
    public Ticket updateTicket(Long id, Ticket updated) {
        Ticket ticket = findTicket(id);
        ticket.setTitle(updated.getTitle());
        ticket.setDescription(updated.getDescription());
        ticket.setStatus(updated.getStatus());
        ticket.setPriority(updated.getPriority());
        if (updated.getAssignedTo() != null && updated.getAssignedTo().getId() != null) {
            ticket.setAssignedTo(employeeRepository.getReferenceById(updated.getAssignedTo().getId()));
        } else {
            ticket.setAssignedTo(updated.getAssignedTo());
        }
        if (updated.getTicketType() != null && updated.getTicketType().getId() != null) {
            ticket.setTicketType(ticketTypeRepository.getReferenceById(updated.getTicketType().getId()));
        }
        log.info("Updating ticket id={}", id);
        return ticketRepository.save(ticket);
    }

    @Transactional
    public void deleteTicket(Long id) {
        Ticket ticket = findTicket(id);
        ticket.setActive(false);
        ticketRepository.save(ticket);
        log.info("Soft-deleted ticket id={}", id);
    }

    // ─── Ticket Status Transitions ────────────────────────────────────────────

    @Transactional
    public Ticket assignTicket(Long ticketId, Long assigneeId) {
        Ticket ticket = findTicket(ticketId);
        ticket.setAssignedTo(employeeRepository.findById(assigneeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", assigneeId)));
        if (ticket.getStatus() == Ticket.TicketStatus.OPEN) {
            ticket.setStatus(Ticket.TicketStatus.IN_PROGRESS);
        }
        log.info("Assigned ticket id={} to employee id={}", ticketId, assigneeId);
        return ticketRepository.save(ticket);
    }

    @Transactional
    public Ticket resolveTicket(Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        ticket.setStatus(Ticket.TicketStatus.RESOLVED);
        log.info("Resolved ticket id={}", ticketId);
        return ticketRepository.save(ticket);
    }

    @Transactional
    public Ticket closeTicket(Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        ticket.setStatus(Ticket.TicketStatus.CLOSED);
        log.info("Closed ticket id={}", ticketId);
        return ticketRepository.save(ticket);
    }

    @Transactional
    public Ticket reopenTicket(Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        ticket.setStatus(Ticket.TicketStatus.OPEN);
        log.info("Reopened ticket id={}", ticketId);
        return ticketRepository.save(ticket);
    }

    /**
     * Escalates a ticket by raising its priority to CRITICAL if it is not yet resolved
     * and was created more than the given SLA hours ago.
     *
     * @param ticketId the ticket to evaluate
     * @param slaHours number of hours after which an unresolved ticket is considered overdue
     * @return the (possibly updated) ticket
     */
    @Transactional
    public Ticket escalateTicket(Long ticketId, int slaHours) {
        Ticket ticket = findTicket(ticketId);
        boolean isUnresolved = ticket.getStatus() != Ticket.TicketStatus.RESOLVED
                && ticket.getStatus() != Ticket.TicketStatus.CLOSED;
        boolean isPastSla = ticket.getCreatedAt() != null
                && ticket.getCreatedAt().plusHours(slaHours).isBefore(LocalDateTime.now());
        if (isUnresolved && isPastSla) {
            ticket.setPriority(Ticket.Priority.CRITICAL);
            log.info("Escalated ticket id={} to CRITICAL (past SLA of {}h)", ticketId, slaHours);
            return ticketRepository.save(ticket);
        }
        log.info("Ticket id={} does not require escalation", ticketId);
        return ticket;
    }

    // ─── Comments & Attachments ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TicketComment> listComments(Long ticketId) {
        findTicket(ticketId);
        return ticketCommentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);
    }

    @Transactional
    public TicketComment addComment(Long ticketId, String commentText) {
        Ticket ticket = findTicket(ticketId);
        if (commentText == null || commentText.isBlank() || commentText.length() > 10000) {
            throw new BadRequestException("Enter a message of no more than 10000 characters");
        }
        if (ticket.getStatus() == Ticket.TicketStatus.CLOSED) {
            throw new BadRequestException("This ticket is closed. Ask your support team to reopen it before replying");
        }
        var employee = employeeRepository.findByUserId(requireTicketScope().getUserId())
                .orElseThrow(() -> new AccessDeniedException("An employee profile is required to comment"));
        TicketComment comment = new TicketComment();
        comment.setTicket(ticket);
        comment.setComment(commentText.strip());
        comment.setCommentedBy(employee);
        log.info("Adding comment to ticket id={} by employee id={}", ticketId, employee.getId());
        return ticketCommentRepository.save(comment);
    }

    @Transactional(readOnly = true)
    public List<TicketAttachment> listAttachments(Long ticketId) {
        findTicket(ticketId);
        return ticketAttachmentRepository.findByTicketId(ticketId);
    }

    @Transactional
    public TicketAttachment addAttachment(Long ticketId, TicketAttachment attachment) {
        if (attachment.getFilePath() == null || attachment.getFilePath().isBlank() || attachment.getFilePath().length() > 255
                || (attachment.getFileName() != null && attachment.getFileName().length() > 255)) {
            throw new BadRequestException("Enter a document link and name of no more than 255 characters each");
        }
        attachment.setId(null);
        attachment.setTicket(findTicket(ticketId));
        log.info("Adding attachment to ticket id={}", ticketId);
        return ticketAttachmentRepository.save(attachment);
    }

    @Transactional
    public void deleteAttachment(Long attachmentId) {
        var attachment = ticketAttachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket attachment", attachmentId));
        findTicket(attachment.getTicket().getId());
        ticketAttachmentRepository.delete(attachment);
        log.info("Deleted attachment id={}", attachmentId);
    }

    // ─── Ticket Queries ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Ticket> getTicketsByEmployee(Long employeeId) {
        return ticketRepository.findAll(visibleTickets().and((root, query, cb) ->
                cb.equal(root.get("raisedBy").get("id"), employeeId)));
    }

    @Transactional(readOnly = true)
    public List<Ticket> getTicketsByAssignee(Long employeeId) {
        return ticketRepository.findAll(visibleTickets().and((root, query, cb) ->
                cb.equal(root.get("assignedTo").get("id"), employeeId)));
    }

    @Transactional(readOnly = true)
    public List<Ticket> getTicketsByDepartment(Long departmentId) {
        List<Ticket> all = listTickets();
        return all.stream()
                .filter(t -> t.getRaisedBy() != null
                        && t.getRaisedBy().getDepartment() != null
                        && departmentId.equals(t.getRaisedBy().getDepartment().getId()))
                .collect(Collectors.toList());
    }

    /**
     * Searches tickets by optional keyword (matches title or description), status, type, and priority.
     * All filtering is applied in-memory after the company-scoped query for flexibility.
     */
    @Transactional(readOnly = true)
    public List<Ticket> searchTickets(String keyword, Ticket.TicketStatus status,
                                      Long typeId, Ticket.Priority priority) {
        List<Ticket> all = listTickets();
        return all.stream()
                .filter(t -> keyword == null || keyword.isBlank()
                        || (t.getTitle() != null && t.getTitle().toLowerCase().contains(keyword.toLowerCase()))
                        || (t.getDescription() != null && t.getDescription().toLowerCase().contains(keyword.toLowerCase())))
                .filter(t -> status == null || status == t.getStatus())
                .filter(t -> typeId == null
                        || (t.getTicketType() != null && typeId.equals(t.getTicketType().getId())))
                .filter(t -> priority == null || priority == t.getPriority())
                .collect(Collectors.toList());
    }

    // ─── Dashboard ────────────────────────────────────────────────────────────

    /**
     * Returns aggregated helpdesk statistics visible to the current user's scope.
     * Overdue tickets are those that are OPEN or IN_PROGRESS and were created more than 48 hours ago.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getDashboard() {
        List<Ticket> tickets = listTickets();

        LocalDateTime overdueThreshold = LocalDateTime.now().minusHours(48);

        long total = tickets.size();
        long open = tickets.stream().filter(t -> t.getStatus() == Ticket.TicketStatus.OPEN).count();
        long inProgress = tickets.stream().filter(t -> t.getStatus() == Ticket.TicketStatus.IN_PROGRESS).count();
        long resolved = tickets.stream().filter(t -> t.getStatus() == Ticket.TicketStatus.RESOLVED).count();
        long closed = tickets.stream().filter(t -> t.getStatus() == Ticket.TicketStatus.CLOSED).count();
        long pending = open + inProgress;
        long overdue = tickets.stream()
                .filter(t -> (t.getStatus() == Ticket.TicketStatus.OPEN
                        || t.getStatus() == Ticket.TicketStatus.IN_PROGRESS)
                        && t.getCreatedAt() != null
                        && t.getCreatedAt().isBefore(overdueThreshold))
                .count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", total);
        result.put("open", open);
        result.put("inProgress", inProgress);
        result.put("resolved", resolved);
        result.put("closed", closed);
        result.put("pending", pending);
        result.put("overdue", overdue);
        return result;
    }

    // ─── TicketType CRUD ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TicketType> listTicketTypes() {
        Specification<TicketType> spec = ScopeFilter.byCompany();
        return spec != null ? ticketTypeRepository.findAll(spec) : ticketTypeRepository.findAll();
    }

    @Transactional
    public TicketType createTicketType(TicketType type) {
        if (type.getCompany() != null && type.getCompany().getId() != null) {
            type.setCompany(companyRepository.getReferenceById(type.getCompany().getId()));
        }
        return ticketTypeRepository.save(type);
    }

    @Transactional
    public TicketType updateTicketType(Long id, TicketType updated) {
        TicketType type = ticketTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TicketType", id));
        type.setName(updated.getName());
        return ticketTypeRepository.save(type);
    }

    @Transactional
    public void deleteTicketType(Long id) {
        TicketType type = ticketTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TicketType", id));
        type.setActive(false);
        ticketTypeRepository.save(type);
        log.info("Soft-deleted TicketType id={}", id);
    }

    // ─── FAQ Category CRUD ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<FAQCategory> listFAQCategories() {
        Specification<FAQCategory> spec = ScopeFilter.byCompany();
        Specification<FAQCategory> active = (root, query, cb) -> cb.isTrue(root.get("isActive"));
        return faqCategoryRepository.findAll(spec == null ? active : spec.and(active));
    }

    @Transactional
    public FAQCategory createFAQCategory(FAQCategory category) {
        Long companyId = faqManagementPolicy.requireCompany();
        requireFaqText(category.getTitle(), "Category title", 255);
        category.setId(null);
        category.setActive(true);
        category.setCompany(companyRepository.getReferenceById(companyId));
        return faqCategoryRepository.save(category);
    }

    @Transactional
    public FAQCategory updateFAQCategory(Long id, FAQCategory updated) {
        Long companyId = faqManagementPolicy.requireCompany();
        FAQCategory category = findFaqCategory(id, companyId);
        requireFaqText(updated.getTitle(), "Category title", 255);
        category.setTitle(updated.getTitle());
        category.setDescription(updated.getDescription());
        return faqCategoryRepository.save(category);
    }

    @Transactional
    public void deleteFAQCategory(Long id) {
        var category = findFaqCategory(id, faqManagementPolicy.requireCompany());
        if (faqRepository.findByCategoryId(id).stream().anyMatch(FAQ::isActive)) {
            throw new BadRequestException("Move or remove the FAQs in this category before deleting it");
        }
        category.setActive(false);
        faqCategoryRepository.save(category);
    }

    // ─── FAQ CRUD ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<FAQ> listFAQs(Long categoryId) {
        Specification<FAQ> spec = ScopeFilter.byCompany();
        Specification<FAQ> active = (root, query, cb) -> cb.isTrue(root.get("isActive"));
        if (categoryId != null) active = active.and((root, query, cb) -> cb.equal(root.get("category").get("id"), categoryId));
        return faqRepository.findAll(spec == null ? active : spec.and(active));
    }

    @Transactional
    public FAQ createFAQ(FAQ faq) {
        Long companyId = faqManagementPolicy.requireCompany();
        requireFaqText(faq.getQuestion(), "Question", 255);
        requireFaqText(faq.getAnswer(), "Answer", 10000);
        faq.setId(null);
        faq.setActive(true);
        if (faq.getCategory() != null && faq.getCategory().getId() != null) {
            faq.setCategory(findFaqCategory(faq.getCategory().getId(), companyId));
        }
        faq.setCompany(companyRepository.getReferenceById(companyId));
        return faqRepository.save(faq);
    }

    @Transactional
    public FAQ updateFAQ(Long id, FAQ updated) {
        FAQ faq = findFaq(id, faqManagementPolicy.requireCompany());
        requireFaqText(updated.getQuestion(), "Question", 255);
        requireFaqText(updated.getAnswer(), "Answer", 10000);
        faq.setQuestion(updated.getQuestion());
        faq.setAnswer(updated.getAnswer());
        faq.setCategory(updated.getCategory() == null || updated.getCategory().getId() == null ? null
                : findFaqCategory(updated.getCategory().getId(), faq.getCompany().getId()));
        return faqRepository.save(faq);
    }

    @Transactional
    public void deleteFAQ(Long id) {
        FAQ faq = findFaq(id, faqManagementPolicy.requireCompany());
        faq.setActive(false);
        faqRepository.save(faq);
    }

    private FAQCategory findFaqCategory(Long id, Long companyId) {
        return faqCategoryRepository.findById(id).filter(FAQCategory::isActive)
                .filter(category -> category.getCompany() != null && companyId.equals(category.getCompany().getId()))
                .orElseThrow(() -> new ResourceNotFoundException("FAQCategory", id));
    }

    private FAQ findFaq(Long id, Long companyId) {
        return faqRepository.findById(id).filter(FAQ::isActive)
                .filter(faq -> faq.getCompany() != null && companyId.equals(faq.getCompany().getId()))
                .orElseThrow(() -> new ResourceNotFoundException("FAQ", id));
    }

    private static void requireFaqText(String text, String field, int limit) {
        if (text == null || text.isBlank() || text.length() > limit) {
            throw new BadRequestException(field + " is required and must not exceed " + limit + " characters");
        }
    }

    // ─── ClaimRequest CRUD ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ClaimRequest> listClaims() {
        Specification<ClaimRequest> spec = ScopeFilter.byEmployee();
        return spec != null ? claimRequestRepository.findAll(spec) : claimRequestRepository.findAll();
    }

    @Transactional
    public ClaimRequest createClaim(ClaimRequest claim) {
        if (claim.getEmployee() != null && claim.getEmployee().getId() != null) {
            claim.setEmployee(employeeRepository.getReferenceById(claim.getEmployee().getId()));
        }
        if (claim.getCompany() != null && claim.getCompany().getId() != null) {
            claim.setCompany(companyRepository.getReferenceById(claim.getCompany().getId()));
        }
        if (claim.getTicket() != null && claim.getTicket().getId() != null) {
            claim.setTicket(ticketRepository.getReferenceById(claim.getTicket().getId()));
        }
        log.info("Creating claim request for employee id={}", claim.getEmployee() != null ? claim.getEmployee().getId() : null);
        return claimRequestRepository.save(claim);
    }

    @Transactional
    public ClaimRequest approveClaim(Long id) {
        ClaimRequest claim = claimRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ClaimRequest", id));
        claim.setIsApproved(true);
        claim.setIsRejected(false);
        log.info("Approved ClaimRequest id={}", id);
        return claimRequestRepository.save(claim);
    }

    @Transactional
    public ClaimRequest rejectClaim(Long id) {
        ClaimRequest claim = claimRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ClaimRequest", id));
        claim.setIsRejected(true);
        claim.setIsApproved(false);
        log.info("Rejected ClaimRequest id={}", id);
        return claimRequestRepository.save(claim);
    }

    @Transactional
    public void deleteClaim(Long id) {
        ClaimRequest claim = claimRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ClaimRequest", id));
        claim.setActive(false);
        claimRequestRepository.save(claim);
        log.info("Soft-deleted ClaimRequest id={}", id);
    }

    // ─── Department Managers ──────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DepartmentManager> listDepartmentManagers(Long departmentId) {
        if (departmentId != null) {
            return departmentManagerRepository.findByDepartmentId(departmentId);
        }
        Specification<DepartmentManager> spec = ScopeFilter.byCompany();
        return spec != null ? departmentManagerRepository.findAll(spec) : departmentManagerRepository.findAll();
    }

    @Transactional
    public DepartmentManager assignDepartmentManager(DepartmentManager dm) {
        if (dm.getDepartment() != null && dm.getDepartment().getId() != null) {
            dm.setDepartment(departmentRepository.getReferenceById(dm.getDepartment().getId()));
        }
        if (dm.getManager() != null && dm.getManager().getId() != null) {
            dm.setManager(employeeRepository.getReferenceById(dm.getManager().getId()));
        }
        if (dm.getCompany() != null && dm.getCompany().getId() != null) {
            dm.setCompany(companyRepository.getReferenceById(dm.getCompany().getId()));
        }
        log.info("Assigning department manager for department id={}", dm.getDepartment() != null ? dm.getDepartment().getId() : null);
        return departmentManagerRepository.save(dm);
    }

    @Transactional
    public void removeDepartmentManager(Long id) {
        departmentManagerRepository.deleteById(id);
        log.info("Removed DepartmentManager id={}", id);
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    private Ticket findTicket(Long id) {
        return ticketRepository.findOne(visibleTickets().and((root, query, cb) -> cb.equal(root.get("id"), id)))
                .orElseThrow(() -> new ResourceNotFoundException("Ticket", id));
    }

    private AccessScopeContext.ScopeData requireTicketScope() {
        var scope = AccessScopeContext.get();
        if (scope == null || scope.getUserId() == null) {
            throw new AccessDeniedException("Select a company to open its Helpdesk");
        }
        return scope;
    }

    private Specification<Ticket> visibleTickets() {
        var scope = requireTicketScope();
        return (root, query, cb) -> {
            var company = root.get("company").get("id");
            var active = cb.isTrue(root.get("isActive"));
            if (scope.hasUnrestrictedAccess()) {
                return scope.getCompanyId() == null ? cb.disjunction()
                        : cb.and(active, cb.equal(company, scope.getCompanyId()));
            }
            var permittedCompany = scope.getFilterCompanyId() == null
                    ? company.in(scope.getAccessibleCompanyIds())
                    : cb.equal(company, scope.getFilterCompanyId());
            var visible = cb.and(active, permittedCompany);
            if (scope.isSelfScope() || scope.getScope() == UserRole.AccessScope.DEPARTMENT) {
                var raisedBy = root.join("raisedBy");
                var own = cb.equal(raisedBy.get("user").get("id"), scope.getUserId());
                if (scope.getScope() == UserRole.AccessScope.DEPARTMENT && scope.getDepartmentId() != null) {
                    var department = raisedBy.join("department", jakarta.persistence.criteria.JoinType.LEFT);
                    own = cb.or(own, cb.equal(department.get("id"), scope.getDepartmentId()));
                }
                return cb.and(visible, own);
            }
            return visible;
        };
    }
}
