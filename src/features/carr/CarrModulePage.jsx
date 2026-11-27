import './car-reference.css'
import './carr-ui.css'
import {legacyCarrRoutes,canonicalCarrPath} from './carr-routing.js'
import {ReferenceShell,ReferenceHome,ReferenceReports,ReferenceSettings} from './car-reference.js'
import TaskWorkspace from './carr-tasks.js'
import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Library, FileText, ListChecks, Network, Target, Gift, CheckCircle2, CalendarCheck, BarChart3, Bot, FileBarChart, Settings, ArrowLeft, Search, Bell, Sparkles, UserCircle, Building2 } from 'lucide-react'
import api from '../../services/api'
import CarrPage from './CarrPage'
import CarrDashboardPage from './CarrDashboardPage'
import CarrJobDescriptionsPage from './CarrJobDescriptionsPage'
import CarrAccountabilityPage from './CarrAccountabilityPage'
import CarrResponsibilitiesPage from './CarrResponsibilitiesPage'
import CarrKpiPage from './CarrKpiPage'
import NotificationsPage from '../notifications/NotificationsPage'
import CompanySwitcher from '../../components/layout/CompanySwitcher'
import { selectPlatformCompanies } from '../platform/platformSlice'
import { canManageCarr } from './carr-creation.js'

const nav = [
  ['Home','dashboard',LayoutDashboard],
  ['My CARs','employees',Users],
  ['Roles & Responsibilities','job-descriptions',Library],
  ['Reports','reports',FileBarChart],
  ['Settings','configuration',Settings],
]
const list = d => Array.isArray(d) ? d : d?.content || []

export default function CarrModulePage(){
 const companyKey=useSelector(s=>`${s.auth.selectedCompanyId||s.auth.user?.companyId||''}:${s.auth.enterpriseBranchFilter||''}`);
 const roles=useSelector(state=>state.auth.roles)||[];
 const canManage=canManageCarr(roles);
 return <ReferenceShell roles={roles}><Routes key={companyKey}>
  <Route index element={<Navigate to="dashboard" replace/>}/>
  <Route path="dashboard" element={<CarrHome/>}/>
  <Route path="cars" element={<CarrPage initialTab="employees"/>}/>
  <Route path="employees" element={<CarrAlias/>}/>
  <Route path="reports" element={<ReferenceReports/>}/>
  <Route path="settings" element={<ReferenceSettings/>}/>
  <Route path="configuration" element={<CarrAlias/>}/>
  <Route path="tasks" element={<TaskWorkspace/>}/>
  <Route path="my-tasks" element={<TaskWorkspace myOnly/>}/>
  <Route path="workflows" element={<TaskWorkspace view="reviews"/>}/>
  <Route path="analytics" element={<TaskWorkspace view="analytics"/>}/>
  <Route path="job-descriptions" element={canManage?<CarrJobDescriptionsPage/>:<Navigate to="/carr/dashboard" replace/>}/>
  <Route path="responsibilities" element={<CarrResponsibilitiesPage/>}/>
  <Route path="accountability" element={<CarrAccountabilityPage/>}/>
  <Route path="kpis" element={<CarrKpiPage/>}/>
  <Route path="notifications" element={<NotificationsPage/>}/>
  <Route path="profile" element={<CarrProfile/>}/>
  {Object.keys(legacyCarrRoutes).filter(path=>!['employees','configuration'].includes(path)).map(path=><Route key={path} path={path} element={<CarrAlias/>}/>)}
  <Route path=":section" element={<LiveSection/>}/>
 </Routes></ReferenceShell>;
}

function CarrHome(){const location=useLocation();return new URLSearchParams(location.search).get('create')==='true'?<CarrAlias/>:<ReferenceHome/>}

function CarrAlias(){const location=useLocation();return <Navigate to={canonicalCarrPath(location.pathname,location.search,location.hash)} replace/>}

function CarrProfile(){
  const user=useSelector(s=>s.auth.user)||{}
  const roles=useSelector(s=>s.auth.roles)||[]
  const name=user.fullName||[user.firstName,user.lastName].filter(Boolean).join(' ')||user.name||user.username||user.email||'CARR User'
  const fields=[['Email',user.email||user.username||'—'],['Employee ID',user.employeeId||user.badgeId||'—'],['Company',user.companyName||'Current organization'],['Access roles',roles.join(', ')||'—']]
  return <Shell title="My Profile" subtitle="Your authenticated CARR identity and access scope."><div className="flex flex-col gap-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]"><div className="min-w-0 rounded-2xl border bg-white p-4 text-center sm:p-7"><div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-indigo-100 text-3xl font-black text-indigo-600">{name.slice(0,1).toUpperCase()}</div><h2 className="mt-4 wrap-anywhere text-xl font-black">{name}</h2><p className="mt-1 text-sm text-slate-500">Secure GRECHA.ai account</p></div><div className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6"><h3 className="font-bold">Account information</h3><div className="mt-4 divide-y">{fields.map(([k,v])=><div key={k} className="flex flex-col gap-1 py-4 text-sm sm:grid sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]"><span className="font-medium text-slate-500">{k}</span><span className="min-w-0 wrap-anywhere font-semibold text-slate-800">{v}</span></div>)}</div><Link to="/settings/account" className="mt-5 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white">Manage account security</Link></div></div></Shell>
}

function LiveSection(){
  const section=useLocation().pathname.split('/').pop()
  const meta={roles:['Role Library','Reusable role definitions and CARR templates.'], 'job-descriptions':['Job Descriptions','Role purpose and scope from the live role library.'], responsibilities:['Responsibilities','Accountabilities assigned across employee CARRs.'], accountability:['Clarity & Accountability','Ownership clarity across current CARR records.'], kpis:['KPI / OKR','Live result measures, targets and actual performance.'], rewards:['Rewards Framework','Published results eligible for reward review.'], approvals:['Approvals','CARR records currently moving through governance.'], reviews:['Reviews','Published CARRs and upcoming review dates.'], analytics:['Analytics','Live coverage, result and governance metrics.'], ai:['AI Assistant','AI-assisted CARR generation and quality checks.'], reports:['Reports','Current CARR operational report.'], configuration:['Configuration','CARR workflow and scoring rules.']}[section]||['CARR','']
  const [data,setData]=useState({records:[],templates:[],jobRoles:[],employees:[],dashboard:{}}),[loading,setLoading]=useState(true)
  useEffect(()=>{Promise.all([api.get('/carr/records'),api.get('/carr/templates'),api.get('/job-roles'),api.get('/employees',{params:{page:0,size:1000}}),api.get('/carr/dashboard')]).then(([r,t,j,e,d])=>setData({records:list(r.data),templates:list(t.data),jobRoles:list(j.data),employees:list(e.data),dashboard:d.data||{}})).finally(()=>setLoading(false))},[])
  const rows=useMemo(()=>{
    if(section==='roles') return data.templates.map(t=>({primary:t.title,secondary:t.purpose||'Purpose not defined',detail:t.jobRoleName||'Any role',status:`Version ${t.version||1}`}))
    if(section==='job-descriptions') {
      const descriptions=new Map()
      data.templates.forEach(t=>descriptions.set(`template-${t.id}`,{primary:t.jobRoleName||t.title,secondary:t.purpose||'Purpose not defined',detail:t.scope||t.title,status:`Template v${t.version||1}`}))
      data.records.forEach(r=>{const employee=data.employees.find(e=>String(e.id)===String(r.employeeId)),role=r.jobRoleName||employee?.jobRoleName||employee?.jobPositionName||employee?.designation||r.title;if(!role)return;const key=`role-${role.toLowerCase()}`;if(!descriptions.has(key))descriptions.set(key,{primary:role,secondary:r.purpose||`CARR responsibilities for ${r.employeeName||'assigned employees'}`,detail:r.employeeName||'Employee CARR',status:r.status||'DRAFT'})})
      data.jobRoles.forEach(role=>{const name=role.name||role.title;if(!name)return;const key=`role-${name.toLowerCase()}`;if(!descriptions.has(key))descriptions.set(key,{primary:name,secondary:role.description||'Job description is ready to be defined in the CARR role library.',detail:role.jobPosition?.name||role.jobPositionName||'Company role',status:'Role'})})
      return [...descriptions.values()]
    }
    if(section==='responsibilities'||section==='accountability') return data.records.flatMap(r=>(r.responsibilities||[]).map(x=>({primary:x.statement,secondary:r.employeeName,detail:x.frequency||'—',status:x.priority||'—'})))
    if(section==='kpis') return data.records.flatMap(r=>(r.kpis||[]).map(x=>({primary:x.name,secondary:r.employeeName,detail:`${x.actualValue??0} / ${x.targetValue??0} ${x.unit||''}`,status:x.riskStatus||'ON TRACK'})))
    let records=data.records
    if(section==='approvals') records=records.filter(r=>['SUBMITTED','MANAGER_REVIEW','DEPT_HEAD_REVIEW','HR_REVIEW','APPROVED'].includes(r.status))
    if(section==='reviews'||section==='rewards') records=records.filter(r=>r.status==='PUBLISHED')
    return records.map(r=>({primary:r.employeeName,secondary:r.title,detail:section==='reviews'?(r.nextReviewDate||'No review date'):`Result ${r.resultScore??0}%`,status:r.status}))
  },[data,section])
  const paged=usePagedRows(rows)
  if(section==='ai') return <Shell title={meta[0]} subtitle={meta[1]}><div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-10 text-center"><Sparkles className="mx-auto text-indigo-600" size={40}/><h3 className="mt-4 text-xl font-bold">AI provider not configured</h3><p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">This screen is intentionally not using demo responses. Connect an approved AI provider in Configuration before enabling generated CARR content.</p></div></Shell>
  return <Shell title={meta[0]} subtitle={meta[1]}>{loading?<div className="py-20 text-center text-slate-400">Loading live CARR data…</div>:<><div className="mb-5 grid gap-4 md:grid-cols-4"><Metric label="Employees" value={data.dashboard.totalActiveEmployees}/><Metric label="Published" value={data.dashboard.published}/><Metric label="Pending approval" value={data.dashboard.pendingApproval}/><Metric label="Coverage" value={`${data.dashboard.coveragePercent||0}%`}/></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">Name</th><th>Context</th><th>Measure / date</th><th>Status</th></tr></thead><tbody>{paged.items.map((r,i)=><tr key={i} className="border-t"><td className="px-5 py-4 font-semibold">{r.primary}</td><td className="text-slate-500">{r.secondary}</td><td>{r.detail}</td><td><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{r.status}</span></td></tr>)}{!rows.length&&<tr><td colSpan="4" className="py-16 text-center text-slate-400">No live records are available for this view yet.</td></tr>}</tbody></table><ModulePager {...paged} total={rows.length}/></div></>}</Shell>
}
function usePagedRows(rows){const[page,setPage]=useState(1),[size,setSize]=useState(25),pages=Math.max(1,Math.ceil(rows.length/size));useEffect(()=>{if(page>pages)setPage(pages)},[page,pages]);const start=(page-1)*size;return{page,size,pages,setPage,setSize,start,items:rows.slice(start,start+size)}}
function ModulePager({page,size,pages,setPage,setSize,total,start}){if(!total)return null;return <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs text-slate-500"><span>Showing {start+1}–{Math.min(start+size,total)} of {total}</span><div className="flex items-center gap-2"><select value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1)}} className="rounded border px-2 py-1">{[10,25,50,100].map(n=><option key={n} value={n}>{n} rows</option>)}</select><button disabled={page===1} onClick={()=>setPage(page-1)} className="rounded border px-2 py-1 disabled:opacity-40">Previous</button><span>Page {page} of {pages}</span><button disabled={page===pages} onClick={()=>setPage(page+1)} className="rounded border px-2 py-1 disabled:opacity-40">Next</button></div></div>}
const Shell=({title,subtitle,children})=><div className="p-7 lg:p-9"><div className="mb-7"><h1 className="text-3xl font-black tracking-tight">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{children}</div>
const Metric=({label,value})=><div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-2xl font-black">{value??0}</div><div className="mt-1 text-xs font-medium text-slate-500">{label}</div></div>
