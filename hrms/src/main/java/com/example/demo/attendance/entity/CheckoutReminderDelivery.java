package com.example.demo.attendance.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

/** Durable deduplication survives restarts and deletion of a notification. */
@Entity @Table(name = "attendance_checkout_reminders") @Getter @Setter
public class CheckoutReminderDelivery {
    @Id @Column(name = "attendance_id") private Long attendanceId;
    @Column(name = "sent_at", nullable = false) private Instant sentAt;
}
