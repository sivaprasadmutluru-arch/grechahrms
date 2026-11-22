import test from 'node:test'
import assert from 'node:assert/strict'
import {canManageCarr,newCarrDraft,fromRoleDraft,reusableDefinition,withEmployee,seedResponsibilities} from '../src/features/carr/carr-creation.js'

test('current and legacy admin names work, employees are not elevated',()=>{
  for(const role of ['SUPER_ADMIN','PLATFORM_SUPER_ADMIN','COMPANY_ADMIN','ACCOUNT_MANAGER','HR_MANAGER','ENTERPRISE_ADMIN'])assert.equal(canManageCarr([role]),true)
  for(const role of ['EMPLOYEE','MANAGER','DEPARTMENT_MANAGER'])assert.equal(canManageCarr([role]),false)
})
test('future hire can have a free-text title without an employee',()=>{
  const draft={...newCarrDraft('ROLE'),title:'Senior Medical Underwriter',responsibilities:seedResponsibilities(['Review medical risk','Approve agreed underwriting outcomes'])}
  const payload=reusableDefinition(draft)
  assert.equal(payload.title,'Senior Medical Underwriter');assert.equal('employeeId' in payload,false)
  assert.equal(payload.responsibilities.reduce((sum,row)=>sum+row.weight,0),100)
  assert.ok(payload.responsibilities.every(row=>row.accountableEmployeeId===null))
})
test('assignment copies definitions, never old results, identities or employee-bound sources',()=>{
  const definition={...newCarrDraft('ROLE'),title:'HR Manager',kpis:[{id:12,name:'Deliver hiring plan',actualValue:99,targetValue:100,unit:'%',weight:100,evidence:'Private evidence',dataSource:'CARR_TASK:10',metricDefinition:'accepted / due x 100'}],responsibilities:[{id:13,statement:'Deliver hiring plan',weight:100,accountableEmployeeId:9}],rewards:[]}
  const draft=fromRoleDraft({id:1,definition},'EMPLOYEE')
  const assigned=withEmployee(draft,{id:100,fullName:'Test Employee',departmentId:2,jobPositionName:'People Manager',reportingManagerId:200,reportingManagerName:'Test Manager'})
  assert.equal(assigned.employeeId,100);assert.equal(assigned.title,'HR Manager');assert.equal(assigned.managerId,200)
  assert.equal(assigned.kpis[0].actualValue,null);assert.equal(assigned.kpis[0].evidence,null);assert.equal(assigned.kpis[0].dataSource,'MANUAL')
  assert.equal(assigned.kpis[0].id,undefined);assert.equal(assigned.responsibilities[0].accountableEmployeeId,100)
  assert.equal(definition.kpis[0].actualValue,99)
})
test('employee selection fills designation and department and resets another employee results',()=>{
  const old={...newCarrDraft(),employeeId:1,title:'Old title',kpis:[{name:'Old private outcome',actualValue:100}]}
  const next=withEmployee(old,{id:2,jobPositionName:'Developer',departmentId:4})
  assert.equal(next.title,'Developer');assert.equal(next.departmentId,4);assert.deepEqual(next.kpis,[])
})
