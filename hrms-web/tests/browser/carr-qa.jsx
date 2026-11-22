// Isolated browser fixture. All requests use an in-memory adapter, never production.
import React from 'react'
import {createRoot} from 'react-dom/client'
import {Provider} from 'react-redux'
import {configureStore} from '@reduxjs/toolkit'
import {MemoryRouter} from 'react-router-dom'
import {Toaster} from 'react-hot-toast'
import CarrPage from '../../src/features/carr/CarrPage'
import {ReferenceViewContext} from '../../src/features/carr/car-reference'
import api from '../../src/services/api'
import '../../src/index.css'
import '../../src/features/carr/car-reference.css'

const employees=[{id:101,fullName:'Alex Test',badgeId:'QA101',departmentId:1,departmentName:'Human Resources',jobPositionName:'HR Executive',reportingManagerId:102,reportingManagerName:'Morgan Test'},
 {id:102,fullName:'Morgan Test',badgeId:'QA102',departmentId:1,departmentName:'Human Resources',jobPositionName:'HR Manager'}]
const titles=[{name:'HR Manager',departmentId:1,departmentName:'Human Resources',purpose:'Lead people operations.',responsibilities:['Complete agreed recruitment plans','Resolve employee enquiries within agreed deadlines','Maintain compliant employee records']},
 {name:'Senior Medical Underwriter',departmentId:null,departmentName:'General suggestions',purpose:'Assess medical risk.',responsibilities:['Review agreed proposals','Document underwriting decisions','Escalate medical risk exceptions']}]
const state={roles:[],records:[],nextId:1}
const scenario=new URLSearchParams(location.search).get('scenario')
const qaRecord=(id,employeeId,status)=>({id,employeeId,employeeName:employees.find(e=>e.id===employeeId)?.fullName,managerId:102,title:'QA HR agreement',status,version:1,companyId:65,effectiveFrom:'2026-11-01',effectiveTo:'2026-12-31',nextReviewDate:'2026-11-01',responsibilities:[{id:1,statement:'Resolve agreed HR requests',weight:100}],kpis:[{id:500,name:'Verified request completion',unit:'%',targetValue:95,actualValue:null,weight:100,dataSource:'MANUAL',reviewFrequency:'Monthly',metricDefinition:'Accepted requests completed / requests due x 100',dueDate:'2026-12-31'}],rewards:[]})
if(scenario==='queues')state.records=[qaRecord(1,101,'SUBMITTED'),qaRecord(2,102,'ACKNOWLEDGEMENT_PENDING'),qaRecord(3,101,'PUBLISHED')]
if(scenario==='published'){state.records=[qaRecord(1,101,'PUBLISHED')];state.nextId=2}
api.defaults.adapter=async config=>{
 const body=typeof config.data==='string'?JSON.parse(config.data):config.data
 let data
 if(config.url==='/carr/creation-context')data={companyId:65,canManage:scenario!=='queues',employeeId:102,employees:scenario==='queues'?[]:employees,departments:[{id:1,name:'Human Resources'}],jobTitles:titles}
 else if(config.url==='/carr/templates')data=[]
 else if(config.url==='/carr/role-drafts'&&config.method==='get')data=state.roles
 else if(config.url==='/carr/role-drafts'&&config.method==='post'){data={id:state.nextId++,title:body.title,version:1,definition:body};state.roles.push(data)}
 else if(config.url.startsWith('/carr/role-drafts/')&&config.method==='put'){const role=state.roles.find(row=>row.id===Number(config.url.split('/').pop()));Object.assign(role,{title:body.title,definition:body,version:role.version+1});data=role}
 else if(config.url==='/carr/records'&&config.method==='get')data=state.records
 else if(config.url==='/carr/records'&&config.method==='post'){const employee=employees.find(row=>String(row.id)===String(body.employeeId));data={...body,id:state.nextId++,employeeName:employee?.fullName,status:'DRAFT',department:employee?.departmentName};state.records.push(data)}
 else if(config.url.match(/\/records\/\d+$/)&&config.method==='put'){data=state.records.find(row=>row.id===Number(config.url.split('/').pop()));Object.assign(data,body)}
 else if(config.url.endsWith('/transition')){data=state.records.find(row=>row.id===Number(config.url.split('/')[3]));data.status=body.status}
 else if(config.url.endsWith('/revisions')){const source=state.records.find(row=>row.id===Number(config.url.split('/')[3]));data={...structuredClone(source),id:state.nextId++,version:source.version+1,revisionOfId:source.id,status:'DRAFT',employeeAcknowledgedAt:null,kpis:source.kpis.map(k=>({...k,id:null,actualValue:null,evidence:null}))};state.records.push(data)}
 else if(config.url==='/carr/role-kpi-suggestions')data=body.responsibilities.map((statement,index,all)=>({name:`On-time completion: ${statement}`,type:'KPI',direction:'INCREASE',targetValue:100,actualValue:null,unit:'%',weight:Math.floor(100/all.length)+(index<100%all.length?1:0),dueDate:body.effectiveTo,dataSource:'MANUAL',reviewFrequency:'Monthly',metricDefinition:'Accepted deliverables completed by their agreed dates / due deliverables x 100. Keep acceptance evidence.',generationKey:`role-outcome-${index}`}))
 else throw new Error(`Unexpected QA request: ${config.method} ${config.url}`)
 return {data:structuredClone(data),status:200,statusText:'OK',headers:{},config}
}
const store=configureStore({reducer:{auth:()=>({roles:[scenario==='queues'?'EMPLOYEE':'SUPER_ADMIN'],selectedCompanyId:65,user:{id:1,companyId:65}})}})
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/carr/cars']}><div className="car-reference"><style>{'.car-reference .car-wizard,.car-reference .car-record-screen{left:0;top:32px}.qa-label{background:#fef3c7;padding:5px 20px;font:13px sans-serif;position:fixed;top:0;left:0;right:0;z-index:40}'}</style><div className="qa-label">Local CARR test — synthetic employees, no production connection</div><ReferenceViewContext.Provider value={scenario==='queues'?'Employee':'Admin / HR'}><CarrPage/></ReferenceViewContext.Provider></div><Toaster/></MemoryRouter></Provider>)
