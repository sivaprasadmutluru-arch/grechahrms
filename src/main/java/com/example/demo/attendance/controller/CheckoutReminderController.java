package com.example.demo.attendance.controller;

import com.example.demo.attendance.service.CheckoutReminderService;
import com.example.demo.auth.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/attendance/checkout-reminders") @RequiredArgsConstructor
public class CheckoutReminderController {
    private final CheckoutReminderService reminders;
    @GetMapping @PreAuthorize("isAuthenticated()")
    public List<CheckoutReminderService.Alert> alerts(@AuthenticationPrincipal UserPrincipal user) {
        return reminders.alerts(user.getId());
    }
}
