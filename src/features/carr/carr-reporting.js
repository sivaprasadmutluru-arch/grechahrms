export const csvCell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}
export function reportCsv(rows){return [['Employee','Designation','Cycle','Version','Status','Start','End','Score %','Next review','Reviewed at'],...rows.map(r=>[r.employeeName,r.title,r.cycleName||'Unassigned',r.version,r.status,r.effectiveFrom,r.effectiveTo,r.resultScore??'Not scored',r.nextReviewDate,r.reviewCompletedAt])].map(row=>row.map(csvCell).join(',')).join('\r\n')}
export function scoreTrend(rows){
 const latest=new Map()
 for(const r of rows){if(!['PUBLISHED','ARCHIVED'].includes(r.status)||r.resultScore==null||!r.effectiveTo)continue;const key=[r.employeeId,r.cycleId||'',r.effectiveFrom,r.effectiveTo].join(':');if(!latest.has(key)||Number(r.version)>Number(latest.get(key).version))latest.set(key,r)}
 const groups=new Map();for(const r of latest.values()){const month=r.effectiveTo.slice(0,7),group=groups.get(month)||[];group.push(Number(r.resultScore));groups.set(month,group)}
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([month,scores])=>({month,count:scores.length,average:scores.reduce((a,b)=>a+b,0)/scores.length}))
}
