// Synthetic API data only; this regression fixture never calls production.
import React from 'react'
import {createRoot} from 'react-dom/client'
import {Toaster} from 'react-hot-toast'
import CarrJobDescriptionsPage from '../../src/features/carr/CarrJobDescriptionsPage'
import api from '../../src/services/api'
import '../../src/index.css'
const populated=new URLSearchParams(location.search).has('populated')
api.defaults.adapter=async config=>{
 let data
 if(config.url==='/carr/templates')data=populated?[{id:1,title:'HR Manager',purpose:'Lead people operations',scope:'Maintain accurate employee records',targetAudience:'BOTH',status:'ACTIVE',departmentId:1,departmentName:'HR',vacancyCount:1,version:1}]:[]
 else if(config.url==='/job-roles')data=[]
 else if(config.url==='/departments')data=[{id:1,name:'HR'}]
 else if(config.url==='/carr/creation-context')data={companyId:65,canManage:true,employees:[],jobTitles:[]}
 else if(config.url==='/carr/salary-benchmark')data={currency:'AED',percentile25:5000,percentile50:7000,percentile75:9000}
 else throw new Error(`Unexpected test request ${config.method} ${config.url}`)
 return {data,status:200,statusText:'OK',headers:{},config}
}
createRoot(document.getElementById('root')).render(<><CarrJobDescriptionsPage/><Toaster/></>)
