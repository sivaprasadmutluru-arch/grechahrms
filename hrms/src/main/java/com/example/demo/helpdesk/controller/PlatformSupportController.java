package com.example.demo.helpdesk.controller;

import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.helpdesk.service.PlatformSupportService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/helpdesk/platform-support")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class PlatformSupportController {
    private final PlatformSupportService support;

    @GetMapping
    public PlatformSupportService.Inbox list(@AuthenticationPrincipal UserPrincipal user,
                                              @RequestParam(defaultValue = "0") int page) {
        return support.list(user, page);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlatformSupportService.Request create(@AuthenticationPrincipal UserPrincipal user,
                                                  @Valid @RequestBody CreateRequest body) {
        return support.create(user, body.subject(), body.description());
    }

    @PutMapping("/{id}/response")
    @PreAuthorize("hasRole('PLATFORM_SUPER_ADMIN')")
    public PlatformSupportService.Request respond(@AuthenticationPrincipal UserPrincipal user, @PathVariable long id,
                                                   @Valid @RequestBody ResponseRequest body) {
        return support.respond(user, id, body.status(), body.response());
    }

    public record CreateRequest(@NotBlank @Size(max = 160) String subject,
                                @NotBlank @Size(max = 4000) String description) {}
    public record ResponseRequest(@NotNull PlatformSupportService.Status status,
                                  @NotBlank @Size(max = 4000) String response) {}
}
