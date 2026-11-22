import test from 'node:test'
import assert from 'node:assert/strict'
import {kpiPayload,responsibilitiesPayload,nextReviewDate,assignmentDates,allocateWeights,kpiConfiguration} from '../src/features/carr/carr-editing.js'
import {reportCsv,scoreTrend} from '../src/features/carr/carr-reporting.js'
test('KPI edit preserves measurement fields and leaves missing actuals unscored',()=>{
 const payload=kpiPayload({name:'Response time',targetValue:'24',actualValue:'',unit:'hours',weight:'100',direction:'DECREASE',metricDefinition:'Mean elapsed hours',reviewFrequency:'Quarterly',generationKey:'response',description:'Queries',dataSource:'MANUAL'})
 assert.equal(payload.actualValue,null);assert.equal(payload.metricDefinition,'Mean elapsed hours');assert.equal(payload.reviewFrequency,'Quarterly');assert.equal(payload.generationKey,'response')
 assert.equal(kpiPayload({...payload,actualValue:'0'}).actualValue,0)
 assert.throws(()=>kpiPayload({...payload,actualValue:'garbage'}))
})
test('Responsibility-only request cannot overwrite CAR, reward or KPI configuration',()=>{
 const payload=responsibilitiesPayload([{id:1,statement:'New text',weight:100,rewardsEnabled:false,kpis:[]}])
 assert.deepEqual(Object.keys(payload),['responsibilities']);assert.equal(payload.responsibilities[0].id,1);assert.equal(payload.kpis,undefined);assert.equal(payload.rewardsEnabled,undefined)
})
test('Review dates clamp month ends and probation uses onboarding dates, not three months',()=>{
 assert.equal(nextReviewDate('2026-01-31','Monthly'),'2026-02-28');assert.equal(nextReviewDate('2026-11-20','Quarterly'),'2027-02-20')
 const employee={dateJoining:'2026-08-01',probationEndsOn:'2027-02-01'}
 assert.equal(assignmentDates(employee,'PROBATION',null,'Quarterly').effectiveTo,'2027-02-01')
 assert.equal(assignmentDates({dateJoining:'2026-08-01'},'PROBATION',null,'Quarterly').effectiveTo,'')
 assert.equal(assignmentDates(employee,'PMS_CYCLE','2026-11-01','Monthly').nextReviewDate,'2026-12-01')
})
test('Reports exclude unscored results, keep zero scores, and do not double-count revisions',()=>{
 const base={employeeId:1,cycleId:4,effectiveFrom:'2026-01-01',effectiveTo:'2026-03-31',status:'ARCHIVED'}
 const trend=scoreTrend([{...base,version:1,resultScore:50},{...base,version:2,status:'PUBLISHED',resultScore:100},{...base,employeeId:2,version:1,resultScore:null},{...base,employeeId:3,version:1,resultScore:0}])
 assert.deepEqual(trend,[{month:'2026-03',count:2,average:50}])
})
test('Report CSV quotes values and neutralizes spreadsheet formulas',()=>{
 const csv=reportCsv([{employeeName:'=HYPERLINK("bad")',title:'A, B',resultScore:null}]);assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));assert.ok(csv.includes('"A, B"'));assert.ok(csv.includes('Not scored'))
})
test('KPI add/remove rebalances a complete configuration without changing unchanged weights',()=>{
 const existing=[{id:1,weight:50},{id:2,weight:25}]
 assert.deepEqual(allocateWeights(existing,75).map(x=>x.weight),[50,25])
 assert.equal(allocateWeights(existing,60).reduce((s,k)=>s+k.weight,0),60)
 assert.ok(allocateWeights(existing,2).every(k=>k.weight===1))
 assert.throws(()=>allocateWeights(existing,1));assert.throws(()=>allocateWeights([],50))
 assert.throws(()=>kpiConfiguration({},[]))
})
