package com.example.demo.attendance.repository;

import com.example.demo.attendance.entity.CheckoutReminderDelivery;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import com.example.demo.notification.entity.Notification;
import java.util.List;

public interface CheckoutReminderRepository extends JpaRepository<CheckoutReminderDelivery, Long> {
    @Modifying
    @Query(value = "INSERT INTO attendance_checkout_reminders(attendance_id,sent_at) VALUES (:id,CURRENT_TIMESTAMP) ON CONFLICT (attendance_id) DO NOTHING", nativeQuery = true)
    int claim(@Param("id") Long attendanceId);

    @Query("SELECT n FROM Notification n WHERE n.recipient.id = :userId AND n.relatedEntity = 'CHECKOUT_REMINDER' AND n.isRead = false ORDER BY n.createdAt DESC, n.id DESC")
    List<Notification> findAlerts(@Param("userId") Long userId, Pageable pageable);
}
