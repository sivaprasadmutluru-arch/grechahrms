export function kpiPayload(form){
 const actual=form.actualValue===''||form.actualValue==null?null:Number(form.actualValue)
 if(actual!==null&&(!Number.isFinite(actual)||actual<0))throw new Error('Enter a valid non-negative actual result')
 return {id:form.id||null,name:form.name,type:form.type||'KPI',direction:form.direction||'INCREASE',targetValue:Number(form.targetValue),actualValue:actual,
  unit:form.unit,weight:Number(form.weight),dueDate:form.dueDate||null,dataSource:form.dataSource||'MANUAL',evidence:form.evidence||null,
  metricDefinition:form.metricDefinition,reviewFrequency:form.reviewFrequency||'Monthly',generationKey:form.generationKey||null,
  description:form.description||null,manuallyEdited:true}
}
export const isAutomaticSource=source=>['TASK_COMPLETION','TASK_ON_TIME','ATTENDANCE_COMPLIANCE'].includes(source)||/^(CARR_TASK|PMS_OBJECTIVE|PROJECT_TASK):[1-9][0-9]*$/.test(source||'')
export function allocateWeights(rows,total){
 if(!Number.isInteger(total)||total<rows.length||total>100||!rows.length&&total!==0)throw new Error(rows.length?'Leave at least 1% for each remaining KPI':'A sole KPI must have 100% weight')
 if(!rows.length)return []
 if(rows.every(r=>Number.isInteger(Number(r.weight))&&Number(r.weight)>=1)&&rows.reduce((n,r)=>n+Number(r.weight),0)===total)return rows.map(r=>({...r,weight:Number(r.weight)}))
 const sum=rows.reduce((n,r)=>n+Math.max(1,Number(r.weight)||1),0),remaining=total-rows.length
 const shares=rows.map((r,i)=>{const raw=remaining*Math.max(1,Number(r.weight)||1)/sum;return {i,weight:1+Math.floor(raw),fraction:raw-Math.floor(raw)}})
 let extra=total-shares.reduce((n,r)=>n+r.weight,0)
 for(const row of [...shares].sort((a,b)=>b.fraction-a.fraction||a.i-b.i)){if(extra-->0)row.weight++}
 return rows.map((r,i)=>({...r,weight:shares[i].weight}))
}
export function kpiConfiguration(record,kpis){
 if(!record?.effectiveFrom||!record?.effectiveTo)throw new Error('Set the CAR review start and end dates before configuring KPIs')
 return {kpis:kpis.map(kpiPayload),effectiveFrom:record.effectiveFrom,effectiveTo:record.effectiveTo,nextReviewDate:record.nextReviewDate||null}
}
export function responsibilitiesPayload(rows){return {responsibilities:rows.map(x=>({id:x.id||null,statement:x.statement,
 accountableEmployeeId:x.accountableEmployeeId||null,priority:x.priority||'MEDIUM',frequency:x.frequency||null,evidenceRequired:x.evidenceRequired||null,weight:Number(x.weight)||0}))}}
export const nextReviewDate=(date,frequency)=>{
 if(!date)return ''
 const [y,m,d]=date.split('-').map(Number);const months={Monthly:1,Quarterly:3,'Half-Yearly':6,Yearly:12}[frequency]||3
 const end=new Date(Date.UTC(y,m-1+months+1,0));const result=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),Math.min(d,end.getUTCDate())))
 return result.toISOString().slice(0,10)
}
export function assignmentDates(employee,type,start,frequency){
 const effectiveFrom=start||employee?.dateJoining||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai'}).format(new Date())
 const effectiveTo=type==='PROBATION'?(employee?.probationEndsOn||''):nextReviewDate(effectiveFrom,'Yearly')
 const review=nextReviewDate(effectiveFrom,frequency)
 return {effectiveFrom,effectiveTo,nextReviewDate:effectiveTo&&review>effectiveTo?effectiveTo:review}
}
