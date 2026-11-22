import {useEffect,useMemo,useState} from 'react'
import api from '../../services/api'
import {reportCsv,scoreTrend} from './carr-reporting.js'

export default function CarrReportsPage(){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const [employee,setEmployee]=useState(''),[cycle,setCycle]=useState(''),[status,setStatus]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('')
 useEffect(()=>{let active=true;api.get('/carr/records').then(({data})=>active&&setRows(Array.isArray(data)?data:data.content||[])).catch(e=>active&&setError(e.response?.data?.message||'Unable to load CAR reports')).finally(()=>active&&setLoading(false));return()=>{active=false}},[])
 const filtered=useMemo(()=>rows.filter(r=>(!employee||String(r.employeeId)===employee)&&(!cycle||String(r.cycleId||'NONE')===cycle)&&(!status||r.status===status)&&(!from||r.effectiveTo&&r.effectiveTo>=from)&&(!to||r.effectiveFrom&&r.effectiveFrom<=to)),[rows,employee,cycle,status,from,to])
 const people=[...new Map(rows.map(r=>[String(r.employeeId),r.employeeName])).entries()],cycles=[...new Map(rows.map(r=>[String(r.cycleId||'NONE'),r.cycleName||'No performance cycle'])).entries()]
 const trend=scoreTrend(filtered),invalid=from&&to&&from>to
 const download=()=>{const url=URL.createObjectURL(new Blob(['\uFEFF'+reportCsv(filtered)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='car-performance-report.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className="car-reports">
  <h1 className="title">CAR Performance Reports</h1>
  <p className="muted">Employee and cycle history within your permitted company/team scope. Unrecorded results stay unscored.</p>
  {error&&<p role="alert">{error}</p>}
  <div className="section car-report-filters" role="group" aria-label="Report filters">
   <label className="field"><span>Employee</span><select aria-label="Report employee" value={employee} onChange={e=>setEmployee(e.target.value)}><option value="">All permitted employees</option>{people.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label className="field"><span>Performance cycle</span><select aria-label="Report cycle" value={cycle} onChange={e=>setCycle(e.target.value)}><option value="">All cycles</option>{cycles.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label className="field"><span>Status</span><select aria-label="Report status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{[...new Set(rows.map(r=>r.status))].map(s=><option key={s}>{s}</option>)}</select></label>
   <label className="field"><span>Period from</span><input aria-label="Report period from" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label className="field"><span>Period to</span><input aria-label="Report period to" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
  </div>
  {invalid&&<p role="alert">The end date must not precede the start date.</p>}
  <div className="car-report-actions">
   <p aria-live="polite">{filtered.length} CAR versions · {filtered.filter(r=>r.status==='PUBLISHED').length} published · {filtered.filter(r=>r.resultScore==null).length} unscored</p>
   <button className="btn" disabled={loading||!!error||!!invalid||!filtered.length} onClick={download}>Download filtered CSV</button>
  </div>
  {loading?<p>Loading reports…</p>:<div className="table-wrap car-report-table" tabIndex={0} role="region" aria-label="CAR report results"><table><thead><tr>{['Employee','Designation','Cycle','Version','Status','Review period','Score','Next review'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{r.employeeName}</td><td>{r.title}</td><td>{r.cycleName||'—'}</td><td>{r.version}</td><td>{r.status}</td><td>{r.effectiveFrom||'—'} – {r.effectiveTo||'—'}</td><td>{r.resultScore==null?'Not scored':Number(r.resultScore).toFixed(2)+'%'}</td><td>{r.nextReviewDate||'—'}</td></tr>)}{!filtered.length&&<tr><td colSpan="8">No CAR records match these filters.</td></tr>}</tbody></table></div>}
  <h2 className="car-report-trend-title">Performance by review-period end month</h2>
  <p className="muted">Only scored published/archived agreements; the latest version per employee/cycle/period is used to avoid counting revisions twice.</p>
  {trend.length?<table><thead><tr><th>Month</th><th>Scored agreements</th><th>Average score</th></tr></thead><tbody>{trend.map(t=><tr key={t.month}><td>{t.month}</td><td>{t.count}</td><td>{t.average.toFixed(2)}%</td></tr>)}</tbody></table>:<p>No scored completed agreements for a trend yet.</p>}
 </section>
}
