package com.example.demo.base.service;

import com.example.demo.base.entity.Company;
import com.example.demo.base.entity.ShiftSchedule;
import com.example.demo.base.repository.ShiftScheduleRepository;
import com.example.demo.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ShiftDayTimeServiceTest {
    private final ShiftScheduleRepository shifts = mock(ShiftScheduleRepository.class);
    private final ShiftDayTimeService service = new ShiftDayTimeService(shifts);

    private ShiftSchedule base() {
        var company = new Company();
        company.setId(7L);
        var shift = new ShiftSchedule();
        shift.setId(1L);
        shift.setName("General");
        shift.setCompany(company);
        shift.setWeeklyOffDays("SATURDAY,SUNDAY");
        return shift;
    }

    private ShiftSchedule.DayTiming timing(String start, String end, double hours) {
        return new ShiftSchedule.DayTiming(LocalTime.parse(start), LocalTime.parse(end), hours);
    }

    @Test
    void savesDirectSaturdayTimesAndMakesSaturdayAWorkingDay() {
        var base = base();
        when(shifts.save(any())).thenAnswer(call -> {
            ShiftSchedule saved = call.getArgument(0);
            saved.setId(10L);
            return saved;
        });
        service.apply(base, Map.of(DayOfWeek.SATURDAY, timing("09:00", "13:00", 4)));
        assertEquals(10L, base.getWeekdayShiftIds().get(DayOfWeek.SATURDAY));
        assertEquals("SUNDAY", base.getWeeklyOffDays());
        verify(shifts).save(argThat(s -> s.getCompany().getId().equals(7L)
                && s.getMinimumWorkingHour() == 4 && s.getEndTime().equals(LocalTime.of(13, 0))));
    }

    @Test
    void acceptsOvernightTimesAndFractionalRequiredHours() {
        var base = base();
        when(shifts.save(any())).thenAnswer(call -> {
            ShiftSchedule saved = call.getArgument(0);
            saved.setId(10L);
            return saved;
        });
        service.apply(base, Map.of(DayOfWeek.THURSDAY, timing("23:00", "08:00", 8.5)));
        verify(shifts).save(argThat(s -> s.getMinimumWorkingHour() == 510
                && s.getStartTime().equals(LocalTime.of(23, 0)) && s.getEndTime().equals(LocalTime.of(8, 0))));
    }

    @Test
    void rejectsRequiredHoursLongerThanShiftBeforeWriting() {
        assertThrows(BadRequestException.class, () -> service.apply(base(),
                Map.of(DayOfWeek.SATURDAY, timing("09:00", "13:00", 8))));
        verifyNoInteractions(shifts);
    }

    @Test
    void resavingUnchangedTimesReusesTheExistingShift() {
        var base = base();
        base.setWeekdayShiftIds(Map.of(DayOfWeek.SATURDAY, 4L));
        var half = base();
        half.setId(4L);
        half.setWeeklyOffDays("SUNDAY");
        half.setStartTime(LocalTime.of(9, 0));
        half.setEndTime(LocalTime.of(13, 0));
        half.setMinimumWorkingHour(4);
        when(shifts.findById(4L)).thenReturn(Optional.of(half));
        service.apply(base, Map.of(DayOfWeek.SATURDAY, timing("09:00", "13:00", 4)));
        assertEquals(4L, base.getWeekdayShiftIds().get(DayOfWeek.SATURDAY));
        verify(shifts, never()).save(any());
    }

    @Test
    void changedTimesCreateNewShiftWithoutEditingHistoricalSharedShift() {
        var base = base();
        base.setWeekdayShiftIds(Map.of(DayOfWeek.SATURDAY, 4L));
        var existing = base();
        existing.setId(4L);
        existing.setStartTime(LocalTime.of(9, 0));
        existing.setEndTime(LocalTime.of(13, 0));
        when(shifts.findById(4L)).thenReturn(Optional.of(existing));
        when(shifts.save(any())).thenAnswer(call -> {
            ShiftSchedule saved = call.getArgument(0);
            saved.setId(20L);
            return saved;
        });
        service.apply(base, Map.of(DayOfWeek.SATURDAY, timing("10:00", "14:00", 4)));
        assertEquals(LocalTime.of(9, 0), existing.getStartTime());
        assertEquals(20L, base.getWeekdayShiftIds().get(DayOfWeek.SATURDAY));
        verify(shifts, never()).save(existing);
    }
}
