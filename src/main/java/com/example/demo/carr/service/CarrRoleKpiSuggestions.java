package com.example.demo.carr.service;

import com.example.demo.carr.dto.CarrCreationDtos.RoleSuggestion;
import com.example.demo.carr.dto.CarrDtos.KpiRequest;
import com.example.demo.carr.entity.CarrKpi;
import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Pattern;

/** Editable starter measures, not an invented company policy or an assumed performance result. */
public final class CarrRoleKpiSuggestions {
    private CarrRoleKpiSuggestions(){}
    private record Metric(String name,String target,String unit,CarrKpi.Direction direction,String rule){}
    private static Metric rate(String name,String target,String rule){return new Metric(name,target,"%",CarrKpi.Direction.INCREASE,rule);}
    public static List<KpiRequest> suggest(RoleSuggestion request){return suggest(request,"Monthly");}
    public static List<KpiRequest> suggest(RoleSuggestion request,String reviewFrequency){
        String role=request.title().toLowerCase(Locale.ROOT),context=String.join(" ",request.responsibilities()).toLowerCase(Locale.ROOT);
        String hours="24";
        var explicit=Pattern.compile("within\\s+([1-9][0-9]{0,2})\\s+hours?",Pattern.CASE_INSENSITIVE).matcher(context);
        if(explicit.find())hours=explicit.group(1);
        var response=new Metric("First substantive response time",hours,"hours",CarrKpi.Direction.DECREASE,
                "Mean elapsed clock hours from receipt to first substantive response for eligible queries received in the review period. Define the eligible queue and exclusions before approval; use dated receipt/reply logs as acceptance evidence.");
        List<Metric> metrics;
        if(role.matches(".*(underwrit|insurance|medical risk).*"))metrics=List.of(
                rate("Underwriting decisions within agreed turnaround","95","Cases decided by the agreed case deadline / eligible cases due in the review period × 100. Record case deadlines, decision dates and manager acceptance evidence."),
                rate("First-pass underwriting accuracy","98","Audited underwriting decisions requiring no material correction / audited decisions × 100. Use the agreed audit sample and signed-off acceptance evidence."),response);
        else if(role.matches(".*(support|customer|account manager|client service).*"))metrics=List.of(response,
                rate("Cases resolved within agreed SLA","95","Eligible cases resolved within their agreed SLA / eligible cases due × 100. Define SLA and paused-case exclusions before approval; retain case logs and acceptance evidence."),
                rate("Customer satisfaction","90","Positive responses / valid survey responses × 100. Define the positive-rating threshold and minimum sample; retain survey acceptance evidence."));
        else if(role.matches(".*(hr|human resource|people|recruit|payroll).*"))metrics=List.of(
                rate("Employee lifecycle requests completed on time","95","Approved lifecycle requests completed by their agreed deadlines / eligible requests due × 100. Retain request dates, deadlines and acceptance evidence."),
                rate("Employee record accuracy","98","Audited employee records meeting the agreed completeness and accuracy checklist / records audited × 100. Use the agreed audit sample and acceptance evidence."),response);
        else if(role.matches(".*(develop|engineer|software|qa |tester|devops).*"))metrics=List.of(
                rate("Accepted delivery against agreed commitments","95","Committed deliverables accepted by their due dates / committed deliverables due × 100. Freeze agreed scope for the period and retain acceptance evidence."),
                rate("First-pass delivery quality","95","Delivered items passing agreed acceptance checks without material rework / delivered items assessed × 100. Use test/review results as acceptance evidence."),
                rate("Defects resolved within agreed priority SLA","95","Eligible defects resolved and verified within their priority SLA / eligible defects due × 100. Define priority SLAs before approval and retain verification acceptance evidence."));
        else if(role.matches(".*(sales|business development).*"))metrics=List.of(
                rate("Approved sales target attainment","100","Verified sales recognised in the review period / the manager-approved period sales target × 100. Record the approved target, currency and recognition rules as acceptance evidence."),
                rate("Qualified opportunity conversion","25","Qualified opportunities won / qualified opportunities closed in the review period × 100. Define qualification and closure criteria and retain CRM acceptance evidence."),
                rate("Customer follow-ups completed on time","95","Agreed customer follow-ups completed by their deadlines / follow-ups due × 100. Use dated CRM activity and acceptance evidence."));
        else if(role.matches(".*(finance|accountant|accounts|financial).*"))metrics=List.of(
                rate("Financial reporting delivered on time","100","Required reports approved by their reporting deadlines / reports due × 100. Retain the reporting calendar and approval acceptance evidence."),
                rate("Reconciliation accuracy","98","Reconciliations meeting the agreed control checklist without material correction / reconciliations assessed × 100. Retain signed-off acceptance evidence."),
                rate("Exceptions resolved by agreed deadline","95","Assigned financial exceptions resolved by agreed deadlines / exceptions due × 100. Retain the exception register and acceptance evidence."));
        else metrics=List.of(
                rate("Agreed role outcomes delivered on time","95","Role outcomes accepted by their agreed deadlines / agreed outcomes due in the review period × 100. List the outcomes and deadlines before approval; retain acceptance evidence. Role context: "+request.responsibilities().getFirst()),
                rate("First-pass quality of role deliverables","95","Assessed outputs accepted without material correction / assessed outputs × 100. Agree quality criteria and audit sample, then retain acceptance evidence."),
                rate("Action and risk follow-through","95","Assigned actions and risk mitigations completed by their agreed deadlines / eligible actions due × 100. Retain action-register acceptance evidence."));
        var result=new ArrayList<KpiRequest>();
        for(int i=0;i<metrics.size();i++){
            var metric=metrics.get(i);
            result.add(new KpiRequest(null,metric.name(),CarrKpi.Type.KPI,metric.direction(),new BigDecimal(metric.target()),null,
                    metric.unit(),100/metrics.size()+(i<100%metrics.size()?1:0),request.effectiveTo(),"MANUAL",null,reviewFrequency,metric.rule(),
                    "role-starter-"+i,false,"Suggested starting target for "+request.title()+". Confirm or edit the target, SLA, scope and measurement rule before approval. No actual result is assumed."));
        }
        return result;
    }
}
