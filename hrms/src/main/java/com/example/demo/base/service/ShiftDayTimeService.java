package com.example.demo.base.service;

import com.example.demo.base.entity.ShiftSchedule;
import com.example.demo.base.repository.ShiftScheduleRepository;
import com.example.demo.common.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ShiftDayTimeService {
    private final ShiftScheduleRepository shifts;

    public void apply(ShiftSchedule base, Map<DayOfWeek, ShiftSchedule.DayTiming> timings) {
        if (timings == null) return; // Older clients can continue to send weekdayShiftIds.
        if (base.getCompany() == null || base.getCompany().getId() == null)
            throw new BadRequestException("Select a company before configuring day times");
        // Validate the complete request before saving any day variants.
        timings.forEach((day, timing) -> validate(day, timing));
        var ids = new EnumMap<DayOfWeek, Long>(DayOfWeek.class);
        timings.forEach((day, timing) -> {
            Long oldId = base.getWeekdayShiftIds() == null ? null : base.getWeekdayShiftIds().get(day);
            ShiftSchedule existing = oldId == null ? null : shifts.findById(oldId).orElse(null);
            int minimum = storedMinimum(timing);
            if (existing != null && existing.isActive() && existing.getCompany() != null
                    && Objects.equals(existing.getCompany().getId(), base.getCompany().getId())
                    && !Objects.equals(existing.getId(), base.getId())
                    && (existing.getWeekdayShiftIds() == null || !existing.getWeekdayShiftIds().containsKey(day))
                    && isWorkingOn(existing, day)
                    && Objects.equals(existing.getStartTime(), timing.startTime())
                    && Objects.equals(existing.getEndTime(), timing.endTime())
                    && Objects.equals(existing.getMinimumWorkingHour(), minimum)
                    && Objects.equals(existing.getOvertimeCutoff(), base.getOvertimeCutoff())
                    && Objects.equals(existing.getMinimumOvertimeToApprove(), base.getMinimumOvertimeToApprove())) {
                ids.put(day, existing.getId());
                return;
            }
            // Never change a shared shift or historical attendance when one schedule's day times change.
            var variant = new ShiftSchedule();
            String prefix = base.getName() == null ? "Shift" : base.getName().strip();
            if (prefix.length() > 180) prefix = prefix.substring(0, 180);
            variant.setName(prefix + " — " + day + " " + timing.startTime() + "–" + timing.endTime());
            variant.setCompany(base.getCompany());
            variant.setStartTime(timing.startTime());
            variant.setEndTime(timing.endTime());
            variant.setMinimumWorkingHour(minimum);
            variant.setFullTime(base.getFullTime());
            variant.setOvertimeCutoff(base.getOvertimeCutoff());
            variant.setMinimumOvertimeToApprove(base.getMinimumOvertimeToApprove());
            variant.setWeeklyOffDays(String.join(",", Arrays.stream(DayOfWeek.values())
                    .filter(other -> other != day).map(Enum::name).toList()));
            ids.put(day, shifts.save(variant).getId());
        });
        base.setWeekdayShiftIds(ids);
        base.setWeekdayTimes(new EnumMap<>(DayOfWeek.class));
        base.getWeekdayTimes().putAll(timings);
        if (base.getWeeklyOffDays() != null) {
            base.setWeeklyOffDays(String.join(",", Arrays.stream(base.getWeeklyOffDays().split(","))
                    .map(String::trim).filter(off -> timings.keySet().stream().noneMatch(day -> day.name().equalsIgnoreCase(off)))
                    .toList()));
        }
    }

    public ShiftSchedule populate(ShiftSchedule base) {
        var result = new EnumMap<DayOfWeek, ShiftSchedule.DayTiming>(DayOfWeek.class);
        if (base.getWeekdayShiftIds() != null) base.getWeekdayShiftIds().forEach((day, id) ->
                shifts.findById(id).filter(ShiftSchedule::isActive)
                        .filter(s -> s.getCompany() != null && base.getCompany() != null
                                && Objects.equals(s.getCompany().getId(), base.getCompany().getId()))
                        .ifPresent(s -> result.put(day, new ShiftSchedule.DayTiming(s.getStartTime(), s.getEndTime(),
                                minimumHours(s.getMinimumWorkingHour())))));
        base.setWeekdayTimes(result);
        return base;
    }

    private static boolean isWorkingOn(ShiftSchedule shift, DayOfWeek day) {
        return shift.getWeeklyOffDays() == null || Arrays.stream(shift.getWeeklyOffDays().split(","))
                .noneMatch(off -> day.name().equalsIgnoreCase(off.strip()));
    }

    private static void validate(DayOfWeek day, ShiftSchedule.DayTiming timing) {
        if (day == null || timing == null || timing.startTime() == null || timing.endTime() == null
                || timing.startTime().equals(timing.endTime())) {
            throw new BadRequestException("Enter different start and end times for each customised day");
        }
        long seconds = ChronoUnit.SECONDS.between(timing.startTime(), timing.endTime());
        double duration = (seconds < 0 ? seconds + 86400 : seconds) / 3600.0;
        Double minimum = timing.minimumHours();
        if (minimum == null || !Double.isFinite(minimum) || minimum < 0.5 || minimum > duration
                || Math.abs(minimum * 60 - Math.round(minimum * 60)) > 0.00001) {
            throw new BadRequestException("Required hours for " + day + " must be at least 0.5 hours and no longer than that shift");
        }
    }

    private static int storedMinimum(ShiftSchedule.DayTiming timing) {
        double hours = timing.minimumHours();
        return hours == Math.rint(hours) ? (int) hours : (int) Math.round(hours * 60);
    }

    private static Double minimumHours(Integer value) {
        if (value == null) return null;
        return value <= 24 ? value.doubleValue() : value <= 1440 ? value / 60.0 : value / 3600.0;
    }
}
