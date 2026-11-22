package com.example.demo.carr.service;

import com.example.demo.carr.dto.CarrCreationDtos.RoleSuggestion;
import com.example.demo.carr.entity.CarrKpi;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class CarrRoleKpiSuggestionsTest {
    RoleSuggestion role(String title,String responsibility){return new RoleSuggestion(title,List.of(responsibility),LocalDate.of(2026,11,1),LocalDate.of(2026,11,30));}
    @Test void engineeringAndUnderwritingHaveDifferentRoleAppropriateMeasures(){
        var engineering=CarrRoleKpiSuggestions.suggest(role("Developer","Deliver accepted modules"));
        var underwriting=CarrRoleKpiSuggestions.suggest(role("Senior Medical Underwriter","Respond to client queries within 12 hours"));
        assertTrue(engineering.getFirst().name().contains("delivery"));assertTrue(underwriting.getFirst().name().contains("Underwriting"));
        var response=underwriting.stream().filter(k->k.unit().equals("hours")).findFirst().orElseThrow();
        assertEquals(12,response.targetValue().intValueExact());assertEquals(CarrKpi.Direction.DECREASE,response.direction());
    }
    @Test void everyStarterHasADeadlineMeasurementAndNoAssumedResult(){
        for(String title:List.of("HR Manager","Developer","Medical Underwriter","Customer Support","Sales Executive","Accountant","Custom Specialist")){
            var suggestions=CarrRoleKpiSuggestions.suggest(role(title,"Complete agreed work"));
            assertEquals(100,suggestions.stream().mapToInt(k->k.weight()).sum());
            assertTrue(suggestions.stream().allMatch(k->k.actualValue()==null&&k.evidence()==null&&k.dataSource().equals("MANUAL")&&k.description().contains("Suggested")&&k.metricDefinition().contains("acceptance evidence")&&k.dueDate().equals(LocalDate.of(2026,11,30))));
        }
    }
}
