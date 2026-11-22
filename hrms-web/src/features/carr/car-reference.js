import './car-reference.css';
import {React,h} from './carr-ui.js';
import api from '../../services/api';
import {Link,useNavigate,useLocation} from 'react-router-dom';
import {useSelector,useDispatch} from 'react-redux';
import {logout} from '../auth/authSlice';
import {CompanySelector} from './carr-tasks.js';
import {accountabilityError} from './carr-accountability-validation.js';
import CarrRoleSetup from './CarrRoleSetup.jsx';
import {canManageCarr,seedResponsibilities} from './carr-creation.js';
import CarrCompanySettingsPage from './CarrCompanySettingsPage.jsx';
import CarrReportsPage from './CarrReportsPage.jsx';
import {nextReviewDate} from './carr-editing.js';

const btn=(text,onClick,primary=false,extra={})=>h('button',{type:'button',className:'btn'+(primary?' primary':''),onClick,...extra},text);
const heading=(eyebrow,title,subtitle)=>h(React.Fragment,null,h('div',{className:'eyebrow'},eyebrow),h('h1',{className:'title'},title),subtitle&&h('p',{className:'subtitle'},subtitle));
const metric=(value,label)=>h('div',{className:'metric'},h('strong',null,value),h('span',null,label));
const targetLabel=k=>k.targetText??`${k.targetValue??''}${k.unit||''}`;
export const ReferenceViewContext=React.createContext(null);
export function ReferenceRecord({record,close,canManage,canReview,canAcknowledge=false,onUpdated,onEdit}){
 const [screen,setScreen]=React.useState('document'),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[changes,setChanges]=React.useState(false),[comment,setComment]=React.useState(''),[sections,setSections]=React.useState(['Accountability']),[ack,setAck]=React.useState(false),[history,setHistory]=React.useState([]),[reflection,setReflection]=React.useState(record.employeeReflection||''),[managerComment,setManagerComment]=React.useState((record.managerComments||'').replace(/\nRewards review:.*$/gm,'')),[actuals,setActuals]=React.useState({});
 const r=record,kpis=r.kpis||[],responsibilities=r.responsibilities||[],rewards=r.rewards||[];
 const [ratings,setRatings]=React.useState({}),[eligibility,setEligibility]=React.useState(r.managerComments?.match(/Rewards review: (Eligible|Not eligible);/)?.[1]||'Eligible'),[rewardDecision,setRewardDecision]=React.useState(r.managerComments?.match(/Rewards review: (?:Eligible|Not eligible); (Approved|Modified|Not Awarded|Deferred)/)?.[1]||'Approved');
 const pending=['SUBMITTED','MANAGER_REVIEW','DEPT_HEAD_REVIEW','HR_REVIEW','APPROVED'].includes(r.status);
 const status=r.status==='RETURNED'?'Changes Requested':pending?'Awaiting Approval':r.status==='ACKNOWLEDGEMENT_PENDING'?'Awaiting Acknowledgement':r.status.charAt(0)+r.status.slice(1).toLowerCase();
 const perform=async(path,body)=>{setBusy(true);setError('');try{const response=await api.post(`/carr/records/${r.id}/${path}`,body);onUpdated(response.data);setScreen('document');setChanges(false);}catch(e){setError(e.response?.data?.message||'Unable to complete this action.');}finally{setBusy(false);}};
 const openHistory=async()=>{setError('');try{const result=await api.get(`/carr/records/${r.id}/audit`);setHistory(result.data);setScreen('history');}catch(e){setError(e.response?.data?.message||'Unable to load CAR history.');}};
 const clarity=h('div',{className:'doc-section'},h('h2',null,'C | Clarity'),h('dl',null,[['Purpose',r.purpose],['Reports To',r.managerName||r.reportsToTitle],['Responsible For',r.responsibleFor],['Key Responsibilities',h('ol',null,responsibilities.map((x,i)=>h('li',{key:x.id||i},x.statement)))]].map(([label,value])=>h('div',{className:'definition',key:label},h('dt',null,label),h('dd',null,value||'—')))));
 const accountability=h('div',{className:'doc-section'},h('h2',null,'A | Accountability'),h('div',{className:'table-wrap'},h('table',null,h('thead',null,h('tr',null,['KPI','Target','Review Frequency','Weight'].map(x=>h('th',{key:x},x)))),h('tbody',null,kpis.map((k,i)=>h('tr',{key:k.id||i},h('td',null,k.name),h('td',null,targetLabel(k)),h('td',null,k.reviewFrequency||'Monthly'),h('td',null,k.weight+'%')))),h('tfoot',null,h('tr',null,h('td',{colSpan:3,className:'weight-total'},'Total Weight'),h('td',{className:'weight-total'},kpis.reduce((sum,k)=>sum+Number(k.weight),0)+'%'))))));
 const rewardsDoc=r.rewardsEnabled&&(canReview||r.rewardsVisibleToEmployee)&&h('div',{className:'doc-section'},h('div',{className:'section-head'},h('h2',null,'R | Rewards'),h('span',{className:'status'},r.rewardsVisibleToEmployee?'Visible to employee':'Internal')),rewards.map((x,i)=>h('div',{className:'item',key:x.id||i},h('span',null,x.name),h('span',{className:'muted'},(x.status||'To Be Discussed').replaceAll('_',' ')))));
 const section=(title,children)=>h('div',{className:'section'},title&&h('div',{className:'section-head'},h('h2',null,title)),children);
 return h('div',{className:'car-record-screen'},h('div',{className:'car-record-content'},error&&h('div',{role:'alert',className:'notice warning'},error),
 screen==='history'?h(React.Fragment,null,heading('CAR History',r.title),section('',h('div',{className:'timeline'},history.map((x,i)=>h('div',{className:'event',key:x.id||i},h('strong',null,x.details||x.action),h('span',null,new Date(x.createdAt).toLocaleDateString('en-GB')))))),btn('Back to CAR',()=>setScreen('document'))):
 screen==='review'?h(React.Fragment,null,heading('Same CAR · Review State',r.title),h('div',{className:'notice'},h('strong',null,'Status: Under Review'),h('br'),'Performance is being reviewed against the exact CAR that was published.'),section('A | Accountability Review',h(React.Fragment,null,h('div',{className:'table-wrap'},h('table',null,h('thead',null,h('tr',null,['KPI','Target','Actual','Manager Rating'].map(x=>h('th',{key:x},x)))),h('tbody',null,kpis.map(k=>h('tr',{key:k.id},h('td',null,k.name),h('td',null,targetLabel(k)),h('td',null,h('input',{'aria-label':'Actual '+k.name,type:'number',step:'any',placeholder:'Enter actual',value:actuals[k.id]??k.actualValue??'',onChange:e=>setActuals({...actuals,[k.id]:e.target.value})})),h('td',null,h('select',{'aria-label':'Manager Rating '+k.name,value:ratings[k.id]||(k.evidence?.match(/Manager rating: (Meets|Below|Exceeds)/)?.[1])||'Meets',onChange:e=>setRatings({...ratings,[k.id]:e.target.value})},h('option',null,'Meets'),h('option',null,'Below'),h('option',null,'Exceeds')))))))),h('div',{style:{marginTop:18}},field('Employee Reflection',reflection,setReflection,{textarea:true})),h('div',{style:{marginTop:14}},field('Manager Comments',managerComment,setManagerComment,{textarea:true})))),r.rewardsEnabled&&section('R | Rewards Decision',h('div',{className:'grid'},select('Eligibility',eligibility,setEligibility,['Eligible','Not eligible'].map(value=>({value,label:value}))),select('Final Decision',rewardDecision,setRewardDecision,['Approved','Modified','Not Awarded','Deferred'].map(value=>({value,label:value}))))),btn('Mark Reviewed',async()=>{setBusy(true);setError('');try{for(const k of kpis){if(actuals[k.id]!==undefined||ratings[k.id]!==undefined){const actual=actuals[k.id]??k.actualValue;if(actual==null||actual==='')throw new Error('Enter a verified actual before rating '+k.name);if(!Number.isFinite(Number(actual)))throw new Error('Enter a valid actual for '+k.name);await api.patch(`/carr/records/${r.id}/kpis/${k.id}/actual`,{actualValue:Number(actual),evidence:(managerComment+'\nManager rating: '+(ratings[k.id]||'Meets')).slice(0,1000)});}}await perform('complete-review',{employeeReflection:reflection,managerComments:managerComment+(r.rewardsEnabled?'\nRewards review: '+eligibility+'; '+rewardDecision:'')});}catch(e){setError(e.response?.data?.message||e.message||'Unable to save the review.');}finally{setBusy(false);}},true,{disabled:busy}),btn('Back to CAR',()=>setScreen('document'))):
 h(React.Fragment,null,
 pending&&canReview&&screen!=='full-document'&&h(React.Fragment,null,heading('Approval',r.title+' CAR'),h('div',{className:'notice'},h('strong',null,'Status: Awaiting Approval'),h('br'),'Manager approval is required before employee acknowledgement.'),h('div',{className:'approval'},h('div',{className:'section'},h('h2',null,'Performance agreement'),h('p',null,'Clarity, Accountability'+(r.rewardsEnabled?' and Rewards':'')+' are ready for review.'),btn('View Full CAR',()=>setScreen('full-document'))),h('div',{className:'section'},h('h2',null,'Manager action'),h('p',{className:'muted'},'Review the agreement and either request focused changes or approve it.'),h('div',{className:'actions'},btn('Request Changes',()=>setChanges(true),false,{className:'btn danger',disabled:busy}),btn('Approve CAR',()=>perform('approve'),true,{disabled:busy}))))),
 r.status==='ACKNOWLEDGEMENT_PENDING'&&canAcknowledge&&h(React.Fragment,null,heading('Employee Acknowledgement','Review and acknowledge your CAR'),h('div',{className:'section'},h('h2',null,r.title),h('p',null,'I confirm that I have reviewed and understood my CAR.'),h('label',{style:{display:'flex',gap:10,alignItems:'center',margin:'22px 0'}},h('input',{type:'checkbox',checked:ack,onChange:e=>setAck(e.target.checked)}),' I have reviewed and understood my CAR.'),btn('Acknowledge CAR',()=>perform('acknowledge'),true,{disabled:busy||!ack}))),
 r.status==='RETURNED'&&h(React.Fragment,null,heading('Changes Requested','Revise the highlighted section'),h('div',{className:'notice warning'},h('strong',null,'Manager requested changes'),h('br'),r.returnReason),canManage&&btn('Open flagged section',()=>onEdit(),true)),
 (!pending||!canReview||screen==='full-document')&&r.status!=='RETURNED'&&(r.status!=='ACKNOWLEDGEMENT_PENDING'||canReview)&&h('div',{className:'doc'},h('div',{style:{display:'flex',justifyContent:'space-between',gap:20}},h('div',null,h('div',{className:'eyebrow'},r.status==='PUBLISHED'?'Published performance agreement':'Performance agreement'),h('h1',{className:'doc-title'},r.title)),h('span',{className:'status '+(r.status==='PUBLISHED'?'published':pending?'attention':'')},status)),h('div',{className:'doc-meta'},r.employeeName,' · Version ',r.version,r.revisionOfId?' · Revision of CAR #'+r.revisionOfId:'',' · Next review ',r.nextReviewDate||'—'),clarity,accountability,rewardsDoc),
 (!pending||!canReview||screen==='full-document')&&h('div',{className:'actions',style:{marginTop:22}},r.status==='PUBLISHED'&&canReview&&btn('Review CAR',()=>setScreen('review')),canManage&&btn('View CAR History',openHistory))),
 h('div',{className:'footer-actions'},btn('Back to My CARs',close),h('div',{className:'actions'},canManage&&r.status==='PUBLISHED'&&btn('Create revision',async()=>{if(busy)return;setBusy(true);setError('');try{const {data}=await api.post(`/carr/records/${r.id}/revisions`);onEdit(data);}catch(e){setError(e.response?.data?.message||'Unable to create revision.');}finally{setBusy(false);}},false,{disabled:busy}),canManage&&['DRAFT','RETURNED'].includes(r.status)&&btn('Edit CAR',()=>onEdit(),false,{disabled:busy}),canManage&&['DRAFT','RETURNED'].includes(r.status)&&btn('Submit for Approval →',()=>perform('transition',{status:'SUBMITTED',comment:'Submitted for manager or HR review'}),true,{disabled:busy}),pending&&canReview&&screen==='full-document'&&btn('Request Changes',()=>setChanges(true),false,{disabled:busy}),pending&&canReview&&screen==='full-document'&&btn('Approve CAR',()=>perform('approve'),true,{disabled:busy}))),
 changes&&h('div',{className:'modal-backdrop open',onClick:e=>{if(e.target===e.currentTarget&&!busy)setChanges(false);}},h('div',{className:'modal',role:'dialog','aria-modal':true,'aria-label':'Request Changes'},h('h2',null,'Request Changes'),h('p',{className:'muted'},'Select the section that needs attention and leave a clear comment.'),h('div',{className:'checks'},['Clarity','Accountability',...(r.rewardsEnabled?['Rewards']:[])].map(name=>h('label',{className:'check',key:name},h('input',{type:'checkbox',checked:sections.includes(name),onChange:e=>setSections(e.target.checked?[...sections,name]:sections.filter(x=>x!==name))}),' '+name))),field('Comment',comment,setComment,{textarea:true}),h('div',{className:'actions',style:{justifyContent:'flex-end',marginTop:20}},btn('Cancel',()=>setChanges(false),false,{disabled:busy}),btn('Send Back',()=>perform('request-changes',{comment:sections.join(', ')+': '+comment}),true,{disabled:busy||!sections.length||!comment.trim()}))))));
}
export function ReferenceShell({children,roles}) {
 const location=useLocation(),navigate=useNavigate();
 const user=useSelector(state=>state.auth.user)||{},dispatch=useDispatch(),[query,setQuery]=React.useState('');
 const admin=canManageCarr(roles);
 const role=admin?'Admin / HR':roles.includes('MANAGER')?'Manager':'Employee';
 const [view,setView]=React.useState(role);
 const [menuOpen,setMenuOpen]=React.useState(false);
 React.useEffect(()=>setMenuOpen(false),[location.pathname,location.search]);
 React.useEffect(()=>{if(!menuOpen)return;const close=e=>{if(e.key==='Escape'){setMenuOpen(false);document.getElementById('car-menu-toggle')?.focus();}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[menuOpen]);
 React.useEffect(()=>setView(role),[role]);
 const page=location.pathname.split('/').pop();
 const links=[['Home','dashboard'],['My CARs','cars'],...(admin&&view==='Admin / HR'?[['Job Descriptions','job-descriptions']]:[]),...(view==='Employee'?[['My KPIs / OKRs','kpis']]:[['KPIs & OKRs','kpis'],['Reports','reports']]),['Settings','settings']];
 return h('div',{className:'car-reference'},
  h('div',{className:'app'},h('aside',{className:'sidebar'+(menuOpen?' mobile-menu-open':'')},h('div',{className:'sidebar-brand'},h('div',{className:'brand'},'CAR'),h('div',{className:'brand-sub'},'Clarity. Accountability. Rewards.',h('br'),'Fueling Performance.'),h('button',{id:'car-menu-toggle',type:'button',className:'car-menu-toggle','aria-expanded':menuOpen,'aria-controls':'car-navigation',onClick:()=>setMenuOpen(!menuOpen)},menuOpen?'Close menu':'Menu')),
   h('nav',{id:'car-navigation',className:'nav','aria-label':'CAR navigation'},links.map(([label,path])=>h(Link,{key:path,to:'/carr/'+path,'aria-current':page===path?'page':undefined,className:page===path&&!location.search.includes('create=true')?'active':''},label))),
   admin&&view==='Admin / HR'&&h(Link,{className:'create-nav',to:'/carr/cars?create=true'},'+ Create a CAR'),
   h('div',{className:'sidebar-footer'},h(Link,{className:'hrms-back',to:'/dashboard'},'\u2190  Back to GRECHA HRMS'),h('small',null,'\u00a9 2026 GRECHA.ai')),
   h('div',{className:'sidebar-note'},'Better people.',h('br'),'Stronger businesses.',h('br'),'Brighter tomorrows.')),
    h('main',{className:'main'},h('header',{className:'topbar'},role!=='Employee'&&h('div',{className:'role-switch'},h('label',{htmlFor:'car-role-view'},'View as'),h('select',{id:'car-role-view',value:view,onChange:e=>{setView(e.target.value);if(e.target.value==='Employee')navigate('/carr/cars');}},(admin?['Admin / HR','Manager','Employee']:role==='Manager'?['Manager','Employee']:['Employee']).map(value=>h('option',{key:value},value)))),h('div',{className:'header-options'},h('form',{className:'header-search',role:'search',onSubmit:event=>{event.preventDefault();navigate('/carr/tasks?q='+encodeURIComponent(query.trim()));}},h('svg',{className:'search-icon',width:15,height:15,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,'aria-hidden':true},h('circle',{cx:11,cy:11,r:8}),h('line',{x1:21,y1:21,x2:16.65,y2:16.65})),h('input',{'aria-label':'Search employee, role, KPI',placeholder:'Search employee, role, KPI...',value:query,onChange:event=>setQuery(event.target.value)}),h('button',{type:'submit',className:'search-btn'},'Search')),role!=='Employee'&&h(CompanySelector),h(Link,{to:'/carr/notifications',className:'header-notifications','aria-label':'Notifications'},h('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,'aria-hidden':true},h('path',{d:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4'}))),h(Link,{to:'/carr/profile',className:'header-profile','aria-label':'User profile',title:user.firstName||user.username||'Profile'},(user.firstName||user.username||'P').charAt(0).toUpperCase()),h('button',{className:'header-logout',type:'button',onClick:()=>{dispatch(logout());navigate('/login',{replace:true});}},'Logout')),h('div',{className:'date'},new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Calcutta'}).format(new Date()))),h('div',{className:'content'},h(ReferenceViewContext.Provider,{value:view},children)))));
}
export function ReferenceHome(){
 const [tasks,setTasks]=React.useState([]),[taskError,setTaskError]=React.useState('');
 React.useEffect(()=>{api.get('/carr/tasks?mine=true').then(({data})=>setTasks(data)).catch(()=>setTaskError('Unable to load assigned tasks.'));},[]);
 const view=React.useContext(ReferenceViewContext),navigate=useNavigate(),[data,setData]=React.useState(null),[error,setError]=React.useState('');
 React.useEffect(()=>{let active=true;api.get('/carr/dashboard').then(r=>active&&setData(r.data)).catch(()=>active&&setError('Unable to load CAR summary.')).finally(()=>{});return()=>{active=false;};},[]);
 return h('section',null,heading('Clarity → Accountability → Rewards','Fueling Performance.','Turn a role into a clear performance agreement with the help of AI.'),
 h('div',{className:'actions',style:{marginTop:24}},view==='Admin / HR'&&btn('+ Create a CAR',()=>navigate('/carr/cars?create=true'),true),btn('View My CARs',()=>navigate('/carr/cars')),btn('View My Tasks',()=>navigate('/carr/my-tasks'))),
 h('div',{className:'hero'},h('div',{className:'section-head'},h('div',null,h('h2',{style:{font:'700 27px var(--serif)',color:'var(--navy)',margin:0}},'A simpler way to agree performance'),h('p',{className:'muted'},'Editable suggestions. Human decides. CAR remembers.'))),
 error?h('p',{role:'alert'},error):h('div',{className:'metrics'},metric(data?.published??'—','Published CARs'),metric(data?.pendingApproval??'—','Awaiting approval'),metric(data?.reviewsOverdue??'—','Review due'))),h('div',{className:'section',style:{marginTop:22}},h('h2',null,'My assigned tasks'),taskError?h('p',{role:'alert'},taskError):h('div',{className:'metrics'},metric(tasks.filter(task=>task.status!=='CANCELLED').length,'Assigned tasks'),metric(tasks.filter(task=>task.status==='COMPLETED').length,'Completed'),metric(tasks.filter(task=>task.overdue).length,'Overdue'))));
}
export function ReferenceReports(){return h(CarrReportsPage);}
export function ReferenceSettings(){return h(CarrCompanySettingsPage);}
const field=(label,value,onChange,options={})=>h('div',{className:'field'+(options.full?' full':'')},h('label',null,label),h(options.textarea?'textarea':'input',{'aria-label':label,value:value??'',onChange:onChange?e=>onChange(e.target.value):undefined,type:options.type||'text',required:options.required,readOnly:options.readOnly,placeholder:options.placeholder}));
const select=(label,value,onChange,options)=>h('div',{className:'field'},h('label',null,label),h('select',{'aria-label':label,value:value??'',onChange:e=>onChange(e.target.value)},h('option',{value:''},'Select'),options.map(o=>h('option',{key:o.value,value:o.value},o.label))));
export function ReferenceWizard({draft,setDraft,step,setStep,employees,departments,jobTitles=[],templates,save,submit,busy,close,upload,jd,setJd,uploadName,defaultReviewFrequency='Quarterly'}){
 const [validationError,setValidationError]=React.useState('');const [jdExpanded,setJdExpanded]=React.useState(false);
 const errorRef=React.useRef(null);
 React.useEffect(()=>{if(validationError){errorRef.current?.focus();errorRef.current?.scrollIntoView({block:'center'});}},[validationError]);
 const validateAccountability=()=>{const message=accountabilityError(draft.kpis,draft.effectiveFrom,draft.effectiveTo);setValidationError(message);return !message;};
 const [jdMode,setJdMode]=React.useState('none');
 const d=draft,update=(name,value)=>setDraft(previous=>({...previous,[name]:value}));
 const selectedEmployee=employees.find(e=>String(e.id)===String(d.employeeId));
 const designation=d.title?.trim()||'';
 const [generating,setGenerating]=React.useState(false);
 const generatingRef=React.useRef(false);
 const periodFields=h('div',{className:'grid'},field('Review start date',d.effectiveFrom,v=>setDraft(previous=>({...previous,effectiveFrom:v,nextReviewDate:!previous.nextReviewDate||previous.nextReviewDate===nextReviewDate(previous.effectiveFrom,defaultReviewFrequency)?nextReviewDate(v,defaultReviewFrequency):previous.nextReviewDate})),{type:'date'}),field('Review end date',d.effectiveTo,v=>update('effectiveTo',v),{type:'date'}));
 const generate=async(regenerate=false)=>{
   if(generatingRef.current)return false;
   if(!designation||(d.creationMode!=='ROLE'&&!d.employeeId)){setValidationError('Enter a job title and choose an employee, or choose Role / future hire.');return false;}
   if(!d.effectiveFrom||!d.effectiveTo||d.effectiveFrom>d.effectiveTo){setValidationError('Enter a valid review start and end date before generating KPIs.');return false;}
   generatingRef.current=true;setGenerating(true);setValidationError('');
   try{
     const {data}=await api.post('/carr/role-kpi-suggestions',{
       title:designation,responsibilities:d.responsibilities.map(r=>r.statement?.trim()).filter(Boolean).slice(0,20),
       effectiveFrom:d.effectiveFrom,effectiveTo:d.effectiveTo,
     });
     // Keep any KPI the user edited or entered manually, even on regeneration.
     setDraft(previous=>{
       const kept=previous.kpis.filter(k=>k.name?.trim()&&(!regenerate||!k.generationKey||k.manuallyEdited));
       const seen=new Set(kept.map(k=>k.name.trim().toLowerCase()));
       const keys=new Set(kept.map(k=>k.generationKey).filter(Boolean));
       const suggested=data.filter(k=>!seen.has(k.name.trim().toLowerCase())&&!keys.has(k.generationKey));
       const rows=[...kept,...suggested].slice(0,50);
       return {...previous,kpis:kept.length?rows:rows.map((k,i)=>({...k,weight:Math.floor(100/rows.length)+(i<100%rows.length?1:0)}))};
     });
     return true;
   }catch(err){setValidationError(err.response?.data?.message||'Unable to generate KPIs. Check the review period and try again.');return false;}
   finally{generatingRef.current=false;setGenerating(false);}
 };
 const advance=async event=>{
   // Cancel the native click action before React can render the final submit control.
   event?.preventDefault();
   if(busy||generatingRef.current)return;
   if(step===0){
     if(!designation||(d.creationMode!=='ROLE'&&!d.employeeId)){setValidationError('Enter a job title. Select an employee only for an employee-assigned CAR.');return;}
     if(!d.responsibilities.some(r=>r.statement?.trim())){
       const entry=jobTitles.find(row=>row.name.toLowerCase()===designation.toLowerCase());
       setDraft(previous=>({...previous,purpose:previous.purpose||entry?.purpose||`Deliver agreed outcomes for ${designation}.`,responsibilities:seedResponsibilities(entry?.responsibilities||['Deliver agreed role outcomes by their due dates','Maintain accurate work records and acceptance evidence','Escalate delivery risks and exceptions'])}));
     }
   }
   if(step===1){
     if(!d.responsibilities.some(r=>r.statement?.trim())){setValidationError('Add at least one responsibility before continuing.');return;}
     if(!d.kpis.some(k=>k.name?.trim())&&!(await generate()))return;
   }
   if(step===2&&!validateAccountability())return;
   setValidationError('');setStep(step+1);
 };
 const edit=(collection,index,key,value)=>setDraft(previous=>({...previous,[collection]:previous[collection].map((row,i)=>i===index?{...row,[key]:value,...(collection==='kpis'?{manuallyEdited:true}:{})}:row)}));
 const total=d.kpis.reduce((sum,k)=>sum+Number(k.weight||0),0);
 const titles=[['Create','Create a CAR','Tell CAR about the role.'],['C | Clarity','What am I here to do?','Editable suggestions. Human decides. Review the role clarity below.'],['A | Accountability','What results am I accountable for?','Set clear targets and agree how performance will be measured.'],['R | Rewards','How may achievement be recognised?','Rewards are optional. They can be discussed without creating a contractual entitlement.'],['Review CAR','Review your CAR','Review this performance agreement before submitting it for approval.']];
 const section=(title,action,children)=>h('div',{className:'section'},h('div',{className:'section-head'},h('h2',null,title),action),children);
 const chooseEmployee=value=>{const employee=employees.find(e=>String(e.id)===String(value));setDraft({...d,title:employee?.jobPositionName?.trim()||'',employeeId:value,departmentId:employee?.departmentId||'',managerId:employee?.reportingManagerId||'',reportsToTitle:employee?.reportingManagerName||'',kpis:String(d.employeeId)===String(value)?d.kpis:d.kpis.filter(k=>!k.generationKey)});};
 return h('div',{className:'car-wizard'},h('form',{onSubmit:event=>{event.preventDefault();if(step!==4)return;if(validateAccountability())submit(event);}},step>0&&h('div',{className:'progress'},['Clarity','Accountability','Rewards','Review CAR'].map((name,i)=>h(React.Fragment,{key:name},h('span',{className:'step '+(i+1===step?'current':i+1<step?'done':'')},h('b',null,i+1),name),i<3&&h('i',{className:'step-line'})))),step<4&&heading(...titles[step]),validationError&&h('div',{className:'notice warning',role:'alert',tabIndex:-1,ref:errorRef},validationError),
 step===0&&h(React.Fragment,null,h(CarrRoleSetup,{draft:d,setDraft,employees,departments,jobTitles,disabled:busy}),
    h('div',{className:'section'},h('h2',null,'Job description (optional)'),h('p',{className:'muted'},'Use a saved role description, upload a document, or start from editable suggestions.'),
      h('div',{className:'grid'},
        templates.length>0&&select('Use a saved description',d.templateId,v=>{const template=templates.find(x=>String(x.id)===String(v));setDraft({...d,templateId:v,purpose:template?.purpose||d.purpose,...(template?.scope?{responsibilities:seedResponsibilities(template.scope.split(/\r?\n/).filter(Boolean))}:{})});},templates.map(x=>({value:x.id,label:x.title}))),
        h('div',{className:'field'},h('label',null,'Upload document (.docx, .txt, .md)'),
          h('div',{style:{display:'flex',alignItems:'center',gap:10,height:42}},
            h('label',{className:'btn small',style:{cursor:'pointer',margin:0,whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:6}},
              '📁 Choose file',
              h('input',{style:{display:'none'},type:'file',accept:'.txt,.md,.docx',onChange:upload,disabled:busy})
            ),
            uploadName?h('span',{style:{fontSize:13,color:'var(--green)',fontWeight:600}},'✓ '+uploadName):h('span',{className:'muted',style:{fontSize:13}},'No file selected')
          )
        )
      ),
      h('div',{className:'field full',style:{marginTop:14}},
         h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}},
           h('label',{className:'field-label',style:{margin:0}},'Paste job description'),
           h('div',{style:{display:'flex',gap:10,alignItems:'center'}},
             jd?h('span',{className:'muted',style:{fontSize:11,fontWeight:500}},(jd.trim().split(/\s+/).filter(Boolean).length)+' words \u00b7 '+jd.length+' chars'):null,
             h('button',{type:'button',className:'btn small',style:{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',fontSize:12},onClick:()=>setJdExpanded(true)},'\u26f6 Maximize Editor')
           )
         ),
         h('textarea',{
           'aria-label':'Paste job description',
           value:jd||'',
           onChange:e=>setJd(e.target.value),
           placeholder:'Paste the full job description here (responsibilities, requirements, qualifications), or upload a file above. Click Maximize Editor to view in fullscreen...',
           style:{minHeight:170,width:'100%',resize:'vertical'}
         })
       ))),
  jdExpanded&&h('div',{className:'modal-backdrop open',style:{display:'grid',position:'fixed',inset:0,background:'rgba(3,18,42,0.65)',backdropFilter:'blur(3px)',zIndex:70,padding:20},onClick:e=>{if(e.target===e.currentTarget)setJdExpanded(false);}},
    h('div',{className:'modal',style:{width:'min(1080px,94vw)',maxHeight:'92vh',display:'flex',flexDirection:'column',padding:24,borderRadius:12,background:'#ffffff',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)'}},
      h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #e2e8f0',paddingBottom:14,marginBottom:16}},
        h('div',null,
          h('h2',{style:{margin:0,fontSize:22,color:'var(--navy)'}},'Job Description Editor & Review'),
          h('p',{className:'muted',style:{margin:'4px 0 0',fontSize:13}},'Review, edit, format, or paste your complete job description.')
        ),
        h('div',{style:{display:'flex',alignItems:'center',gap:10}},
          h('span',{className:'muted',style:{fontSize:12,fontWeight:600}},(jd?jd.trim().split(/\s+/).filter(Boolean).length:0)+' words \u00b7 '+(jd||'').length+' characters'),
          h('button',{type:'button',className:'btn small',onClick:()=>setJd('')},'Clear'),
          h('button',{type:'button',className:'btn primary small',onClick:()=>setJdExpanded(false)},'Done & Close')
        )
      ),
      h('textarea',{
        'aria-label':'Expanded job description',
        value:jd||'',
        onChange:e=>setJd(e.target.value),
        placeholder:'Paste or review full role overview, key duties, deliverables, requirements, reporting lines, qualifications...',
        style:{flex:1,minHeight:'55vh',width:'100%',padding:16,fontSize:14,lineHeight:1.6,border:'1px solid #cbd5e1',borderRadius:8,outline:'none',resize:'none'}
      }),
      h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14,paddingTop:12,borderTop:'1px solid #f1f5f9'}},
        h('span',{className:'muted',style:{fontSize:12}},'\ud83d\udca1 Tip: All content pasted here is used directly by the AI KPI generator to create role responsibilities and measurable targets.'),
        h('button',{type:'button',className:'btn primary',onClick:()=>setJdExpanded(false)},'Done & Return to Wizard')
      )
    )
  ),
 step===1&&section('Save the job description or continue to accountability',btn('Save job description',async()=>{if(await save())close();},true,{disabled:busy||generating}),h(React.Fragment,null,h('p',{className:'muted'},'The job description can be saved now without KPIs. To continue to measurable goals, choose a review period below.'),periodFields)),
 step===1&&h('div',{className:'section'},field('Purpose',d.purpose,v=>update('purpose',v),{textarea:true}),h('div',{className:'grid',style:{marginTop:18}},field('Reports To',d.reportsToTitle,v=>update('reportsToTitle',v)),field('Responsible For',d.responsibleFor,v=>update('responsibleFor',v))),h('div',{className:'section-head',style:{marginTop:24}},h('h2',null,'Roles & Responsibilities'),btn('+ Add Responsibility',()=>update('responsibilities',[...d.responsibilities,{statement:'',weight:0,priority:'HIGH',frequency:'Monthly',accountableEmployeeId:d.employeeId}]),false,{className:'btn small'})),h('div',{className:'item-list'},d.responsibilities.map((r,i)=>h('div',{className:'item',key:i},h('div',null,h('div',{className:'item-title'},`${i+1}. Responsibility`),h('div',{className:'item-copy',contentEditable:true,suppressContentEditableWarning:true,onInput:e=>edit('responsibilities',i,'statement',e.currentTarget.textContent),onBlur:e=>edit('responsibilities',i,'statement',e.currentTarget.textContent)},r.statement)),h('div',{className:'item-actions'},btn('Accept',e=>e.currentTarget.textContent='Accepted',false,{className:'btn small'}),btn('Delete',()=>update('responsibilities',d.responsibilities.filter((_,j)=>j!==i)),false,{className:'btn small danger'})))))),
 step===2&&section('Key Performance Indicators',h('div',{className:'actions'},btn('Regenerate KPI suggestions',()=>generate(true),false,{disabled:generating||busy}),btn('+ Add KPI',()=>update('kpis',[...d.kpis,{name:'',targetValue:'',actualValue:null,weight:0,type:'KPI',direction:'INCREASE',unit:'',reviewFrequency:defaultReviewFrequency,dueDate:d.effectiveTo}]),false,{disabled:generating})),h(React.Fragment,null,periodFields,h('p',{className:'muted'},'Review each suggested target, measurement rule and deadline before approval. Actual results are not assumed.'),h('div',{className:'table-wrap'},h('table',{id:'reference-kpis'},h('thead',null,h('tr',null,['KPI','Target','Deadline','Review Frequency','Weight %',''].map(x=>h('th',{key:x},x)))),h('tbody',null,d.kpis.map((k,i)=>h('tr',{key:i},h('td',null,h('input',{'aria-label':'KPI',value:k.name,onChange:e=>edit('kpis',i,'name',e.target.value)}),h('textarea',{'aria-label':'Measurement rule '+(i+1),placeholder:'Define how to measure this KPI',value:k.metricDefinition||'',onChange:e=>edit('kpis',i,'metricDefinition',e.target.value)})),h('td',null,h('input',{'aria-label':'Target',value:targetLabel(k),onChange:e=>{const text=e.target.value,match=text.match(/-?\d+(?:\.\d+)?/);update('kpis',d.kpis.map((row,j)=>j===i?{...row,manuallyEdited:true,targetText:text,targetValue:match?Number(match[0]):'',unit:match?text.slice(text.indexOf(match[0])+match[0].length).trim():'',direction:/[<\u2264]/.test(text)?'DECREASE':'INCREASE'}:row));}})),h('td',null,h('input',{'aria-label':'KPI deadline',type:'date',value:k.dueDate||'',onChange:e=>edit('kpis',i,'dueDate',e.target.value)})),h('td',null,h('select',{'aria-label':'Review Frequency',value:k.reviewFrequency||'Monthly',onChange:e=>edit('kpis',i,'reviewFrequency',e.target.value)},['Monthly','Quarterly','Half-Yearly','Yearly'].map(x=>h('option',{key:x},x)))),h('td',null,h('input',{'aria-label':'Weight',type:'number',min:1,max:100,value:k.weight,onChange:e=>edit('kpis',i,'weight',Number(e.target.value))})),h('td',null,btn('Delete',()=>update('kpis',d.kpis.filter((_,j)=>j!==i)),false,{className:'btn small danger'}))))),h('tfoot',null,h('tr',null,h('td',{colSpan:4,className:'weight-total'},'Total Weight'),h('td',{colSpan:2,className:'weight-total',style:{color:total===100?'var(--navy)':'var(--red)'}},total+'%')))))),h('div',{style:{marginTop:18}},field('Next Review Date',d.nextReviewDate,v=>update('nextReviewDate',v),{type:'date'}))),
 step===3&&h('div',{className:'section'},h('div',{className:'car-reward-layout'},h('div',null,h('h3',null,'Activation'),h('div',{className:'item-list'},h('button',{type:'button',className:'choice '+(d.rewardsEnabled?'selected':''),onClick:()=>update('rewardsEnabled',true)},h('strong',null,'Activate Rewards'),h('span',{className:'muted'},'Include a reward framework.')),h('button',{type:'button',className:'choice '+(!d.rewardsEnabled?'selected':''),onClick:()=>update('rewardsEnabled',false)},h('strong',null,'Do Not Activate'),h('span',{className:'muted'},'Continue with C + A only.'))),d.rewardsEnabled&&h('div',{style:{marginTop:18}},h('h3',null,'Employee Visibility'),h('label',{style:{display:'block'}},h('input',{type:'radio',name:'reward-visibility',checked:d.rewardsVisibleToEmployee,onChange:()=>update('rewardsVisibleToEmployee',true)}),' Show Rewards'),h('label',{style:{display:'block'}},h('input',{type:'radio',name:'reward-visibility',checked:!d.rewardsVisibleToEmployee,onChange:()=>update('rewardsVisibleToEmployee',false)}),' Keep Internal'))),d.rewardsEnabled&&h('div',null,h('div',{className:'section-head'},h('h2',null,'Reward Details'),btn('+ Add Reward',()=>update('rewards',[...d.rewards,{name:'New Reward Mechanism',status:'TO_BE_DISCUSSED',discussionWith:'BOTH'}]),false,{className:'btn small'})),h('div',{className:'item-list'},d.rewards.map((r,i)=>h('div',{className:'item',key:i},h('div',null,h('div',{className:'item-title',contentEditable:true,suppressContentEditableWarning:true,onInput:e=>edit('rewards',i,'name',e.currentTarget.textContent),onBlur:e=>edit('rewards',i,'name',e.currentTarget.textContent)},r.name),h('div',{className:'item-copy'},'Status: To Be Discussed \u00b7 Discuss with: Both')),h('div',{className:'item-actions'},btn('Edit',e=>e.currentTarget.parentElement.previousElementSibling.firstElementChild.focus(),false,{className:'btn small'}),btn('Delete',()=>update('rewards',d.rewards.filter((_,j)=>j!==i)),false,{className:'btn small danger'})))))))),
 step===4&&h('div',{className:'doc'},h('h1',{className:'doc-title'},d.title),h('div',{className:'doc-meta'},[departments.find(x=>String(x.id)===String(d.departmentId))?.name,d.roleLevel,'Reports to '+d.reportsToTitle].filter(Boolean).join(' · ')),h('p',{className:'muted'},'Review this performance agreement before submitting it for approval.'),h('div',{className:'doc-section'},h('h2',null,'C | Clarity'),h('dl',null,[['Purpose',d.purpose],['Reports To',d.reportsToTitle],['Responsible For',d.responsibleFor],['Key Responsibilities',h('ol',null,d.responsibilities.map((r,i)=>h('li',{key:i},r.statement)))]].map(([label,value])=>h('div',{className:'definition',key:label},h('dt',null,label),h('dd',null,value))))),h('div',{className:'doc-section'},h('h2',null,'A | Accountability'),h('div',{className:'table-wrap'},h('table',null,h('thead',null,h('tr',null,['KPI','Target','Review Frequency','Weight'].map(x=>h('th',{key:x},x)))),h('tbody',null,d.kpis.map((k,i)=>h('tr',{key:i},h('td',null,k.name),h('td',null,targetLabel(k)),h('td',null,k.reviewFrequency||'Monthly'),h('td',null,k.weight+'%')))),h('tfoot',null,h('tr',null,h('td',{colSpan:3,className:'weight-total'},'Total Weight'),h('td',{className:'weight-total'},total+'%')))))),d.rewardsEnabled&&h('div',{className:'doc-section'},h('h2',null,'R | Rewards'),d.rewards.map((r,i)=>h('div',{className:'item',key:i},h('span',null,r.name),h('span',{className:'muted'},'To Be Discussed'))))),
 h('div',{className:'footer-actions'},step>0?btn('Back',()=>{setValidationError('');setStep(step-1);},false,{disabled:busy||generating}):btn('Save Draft',save,false,{disabled:busy||generating}),h('div',{className:'actions'},step>0&&btn('Save Draft',save,false,{disabled:busy||generating}),step<4?btn(['Continue to Clarity \u2192','Continue to Accountability \u2192','Continue to Rewards \u2192','Review CAR \u2192'][step],advance,true,{key:`advance-${step}`,disabled:busy||generating}):h('button',{key:'confirm-submission',type:'submit',className:'btn primary',disabled:busy},busy?'Saving...':d.creationMode==='ROLE'?'Save reusable role CAR':'Submit for Approval \u2192')))));

}

