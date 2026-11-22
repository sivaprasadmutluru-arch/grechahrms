// Actual CARR routes/components with synthetic API responses. Never connects to production.
import React from 'react'
import {createRoot} from 'react-dom/client'
import {Provider} from 'react-redux'
import {configureStore} from '@reduxjs/toolkit'
import {MemoryRouter,Routes,Route} from 'react-router-dom'
import {Toaster} from 'react-hot-toast'
import CarrModulePage from '../../src/features/carr/CarrModulePage'
import api from '../../src/services/api'
import '../../src/index.css'
const params=new URLSearchParams(location.search),employee=params.has('employee')
const store=configureStore({reducer:{auth:(s={selectedCompanyId:65,roles:[employee?'EMPLOYEE':'SUPER_ADMIN'],user:{id:3,companyId:65,firstName:'QA Admin'}},a)=>a.type==='QA_SWITCH'?{...s,selectedCompanyId:a.payload}:s}})
const records=company=>[{
 id:company*10,companyId:company,employeeId:101,employeeName:'Person '+company,title:'Role '+company,managerId:202,status:'DRAFT',version:1,cycleId:1,cycleName:'2026 Review',industry:'Software',roleLevel:'Specialist',responsibleFor:'Delivery',effectiveFrom:'2026-11-01',effectiveTo:'2027-02-01',nextReviewDate:'2027-02-01',rewardsEnabled:true,rewardsVisibleToEmployee:false,
 responsibilities:[{id:1,statement:'Agreed duties '+company,accountableEmployeeId:101,accountableEmployeeName:'Person '+company,weight:100}],
 kpis:[{id:21,name:'Verified delivery '+company,targetValue:95,actualValue:null,unit:'%',weight:100,metricDefinition:'Accepted items / assessed items x 100',reviewFrequency:'Quarterly',dataSource:'MANUAL',generationKey:'delivery',description:'Delivery evidence'}],rewards:[{id:4,name:'Development opportunity',status:'TO_BE_DISCUSSED'}]
},{id:company*10+1,companyId:company,employeeId:101,employeeName:'Person '+company,title:'Published '+company,managerId:202,status:'PUBLISHED',version:1,cycleId:1,cycleName:'2026 Review',effectiveFrom:'2026-08-01',effectiveTo:'2026-10-31',resultScore:90,kpis:[{id:22,name:'Published measure',targetValue:100,actualValue:90,unit:'%',weight:100,metricDefinition:'Accepted items / due items',reviewFrequency:'Quarterly',dataSource:'MANUAL'}],responsibilities:[],rewards:[]}]
const data={65:{rows:records(65),frequency:'Monthly',version:0},66:{rows:records(66),frequency:'Yearly',version:0}}
window.qaCalls=[];window.qaSwitchCompany=id=>store.dispatch({type:'QA_SWITCH',payload:id});window.qaData=data
api.defaults.adapter=async config=>{
 const company=store.getState().auth.selectedCompanyId,state=data[company],body=typeof config.data==='string'?JSON.parse(config.data):config.data
 window.qaCalls.push({company,method:config.method,url:config.url,body});let response
 if(config.url==='/companies/accessible')response=[{id:65,name:'Company A'},{id:66,name:'Company B'}]
 else if(config.url==='/carr/creation-context')response={companyId:company,canManage:!employee,employeeId:202,reviewFrequency:state.frequency,employees:[{id:101,fullName:'Person '+company,dateJoining:'2026-08-01',probationEndsOn:'2027-02-01',probationCovered:true,reportingManagerId:202},{id:202,fullName:'Manager QA'}],departments:[],jobTitles:[]}
 else if(config.url==='/carr/records')response=state.rows
 else if(config.url==='/carr/settings'&&config.method==='get')response={companyId:company,reviewFrequency:state.frequency,version:state.version}
 else if(config.url==='/carr/settings'&&config.method==='put'){state.frequency=body.reviewFrequency;state.version++;response={companyId:company,reviewFrequency:state.frequency,version:state.version}}
 else if(config.url==='/carr/templates')response=[{id:company,title:'Role '+company,scope:'Agreed duties',targetAudience:'BOTH',status:'ACTIVE',version:1}]
 else if(['/job-roles','/departments','/carr/tasks'].includes(config.url))response=[]
 else if(config.url.match(/\/carr\/records\/\d+\/kpis\/\d+$/)){const row=state.rows.find(r=>r.id===Number(config.url.split('/')[3]));Object.assign(row.kpis.find(k=>k.id===Number(config.url.split('/').pop())),body);response=row}
 else if(config.url.endsWith('/kpi-configuration')){const row=state.rows.find(r=>r.id===Number(config.url.split('/')[3]));row.kpis=body.kpis.map((k,i)=>({...k,id:k.id||100+i}));response=row}
 else if(config.url.endsWith('/responsibilities')){const row=state.rows.find(r=>r.id===Number(config.url.split('/')[3]));row.responsibilities=body.responsibilities;response=row}
 else if(config.url.endsWith('/assign'))response={id:999,status:'DRAFT'}
 else if(config.url==='/carr/salary-benchmark')response={currency:'AED',percentile25:5000,percentile50:7000,percentile75:9000,dataSource:'Illustrative estimate only'}
 else throw new Error('Unexpected fixture request '+config.method+' '+config.url)
 return {data:structuredClone(response),status:200,statusText:'OK',headers:{},config}
}
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/carr/'+(params.get('page')||'job-descriptions')]}><Routes><Route path="/carr/*" element={<CarrModulePage/>}/></Routes><Toaster/></MemoryRouter></Provider>)
