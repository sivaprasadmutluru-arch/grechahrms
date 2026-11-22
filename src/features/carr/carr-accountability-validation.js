export function accountabilityError(kpis, start, end) {
 if (!Array.isArray(kpis) || !kpis.length) return 'Add at least one KPI before continuing.';
 if (!start || !end || start > end) return 'Enter a valid review start and end date.';
 for (const [index,kpi] of kpis.entries()) {
  if (!kpi.name?.trim()) return `Enter a KPI name for row ${index+1}.`;
  if (kpi.targetValue === '' || kpi.targetValue == null || !Number.isFinite(Number(kpi.targetValue)) || Number(kpi.targetValue) <= 0) return `Enter a positive target for KPI ${index+1}.`;
  if (!kpi.unit?.trim()) return `Add the target unit for KPI ${index+1}, such as % or hours.`;
  if (!kpi.metricDefinition?.trim() || /configure /i.test(kpi.metricDefinition)) return `Complete the measurement rule for KPI ${index+1}.`;
  const deadline = kpi.dueDate || end;
  if (deadline < start || deadline > end) return `KPI ${index+1} deadline must fall within the review period.`;
  if (!Number.isInteger(Number(kpi.weight)) || Number(kpi.weight)<1 || Number(kpi.weight)>100) return `Enter a weight from 1 to 100 for KPI ${index+1}.`;
 }
 if (kpis.reduce((sum,kpi)=>sum+Number(kpi.weight),0)!==100) return 'KPI weights must total 100% before continuing.';
 return '';
}

