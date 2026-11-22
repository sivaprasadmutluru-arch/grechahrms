package com.example.demo.base.entity;

import com.example.demo.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Map;

@Entity
@Table(name = "shift_schedules")
@Getter
@Setter
public class ShiftSchedule extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "minimum_working_hour")
    private Integer minimumWorkingHour;

    @Column(name = "full_time")
    private Boolean fullTime = true;

    /** Maximum overtime credited for this shift (HH:MM). Overrides company-level overtimeCutoff. */
    @Column(name = "overtime_cutoff")
    private String overtimeCutoff;

    /** Minimum overtime before it is eligible for approval (HH:MM). Overrides company-level value. */
    @Column(name = "minimum_overtime_to_approve")
    private String minimumOvertimeToApprove;

    /** Comma-separated java.time.DayOfWeek names (e.g. "SATURDAY,SUNDAY") that are week-off for this shift; all other days are working days. Null/empty means no week-off days configured. */
    @Column(name = "weekly_off_days")
    private String weeklyOffDays;

    /** Optional alternate shift IDs, keyed by the attendance date's day of the week. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "weekday_shift_ids", columnDefinition = "jsonb")
    private Map<DayOfWeek, Long> weekdayShiftIds;

    /** API-only editable day times; persisted as immutable shift variants through weekdayShiftIds. */
    @Transient
    private Map<DayOfWeek, DayTiming> weekdayTimes;

    public record DayTiming(LocalTime startTime, LocalTime endTime, Double minimumHours) {}

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;
}
