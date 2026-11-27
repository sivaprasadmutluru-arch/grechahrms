package com.example.demo.attendance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalTime;
import java.util.List;

public record AttendanceReportScheduleRequest(
        @NotBlank @Size(max = 120) String name,
        @NotNull Frequency frequency,
        Integer dayOfWeek,
        Integer dayOfMonth,
        @NotNull LocalTime sendAt,
        @NotBlank @Size(max = 64) String timeZone,
        @NotEmpty List<Long> recipientEmployeeIds,
        Boolean enabled
) {
    public enum Frequency { DAILY, WEEKLY, MONTHLY }
}
