export const carrManagementRoles = ['PLATFORM_SUPER_ADMIN','SUPER_ADMIN','ACCOUNT_MANAGER','COMPANY_ADMIN','CEO','ENTERPRISE_ADMIN','COMPANY_MANAGER','BRANCH_ADMIN','HR_MANAGER']
export const canManageCarr = roles => roles.some(role => carrManagementRoles.includes(role))
export const employeeLabel = employee => employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ') || `Employee #${employee.id}`
export function newCarrDraft(creationMode = 'EMPLOYEE') {
  return { creationMode, employeeId:'', departmentId:'', templateId:'', cycleId:'', managerId:'', title:'', purpose:'', industry:'',roleLevel:'', reportsToTitle:'', responsibleFor:'', rewardsEnabled:false,rewardsVisibleToEmployee:true,effectiveFrom:'',effectiveTo:'',nextReviewDate:'',
    responsibilities:[{statement:'',accountableEmployeeId:'',priority:'HIGH',frequency:'Monthly',evidenceRequired:'',weight:100}],kpis:[],rewards:[] }
}
export function reusableDefinition(draft) {
  return {
    title:draft.title.trim(),departmentId:draft.departmentId?Number(draft.departmentId):null,purpose:draft.purpose,industry:draft.industry,roleLevel:draft.roleLevel,reportsToTitle:draft.reportsToTitle,responsibleFor:draft.responsibleFor,
    effectiveFrom:draft.effectiveFrom||null,effectiveTo:draft.effectiveTo||null,nextReviewDate:draft.nextReviewDate||null,rewardsEnabled:!!draft.rewardsEnabled,rewardsVisibleToEmployee:draft.rewardsVisibleToEmployee!==false,
    responsibilities:(draft.responsibilities||[]).filter(row=>row.statement?.trim()).map(row=>({statement:row.statement.trim(),accountableEmployeeId:null,priority:row.priority||'HIGH',frequency:row.frequency||'Monthly',evidenceRequired:row.evidenceRequired||'',weight:Number(row.weight||0)})),
    kpis:(draft.kpis||[]).filter(row=>row.name?.trim()).map(({id,actualValue,evidence,targetText,...row})=>({...row,name:row.name.trim(),targetValue:Number(row.targetValue),weight:Number(row.weight),actualValue:null,evidence:null,dataSource:'MANUAL',dueDate:row.dueDate||draft.effectiveTo||null})),
    rewards:(draft.rewards||[]).filter(row=>row.name?.trim()).map(({id,...row})=>row),
  }
}
export function fromRoleDraft(role, mode = 'ROLE') {
  return {...newCarrDraft(mode),...reusableDefinition({...newCarrDraft(mode),...role.definition}),creationMode:mode,employeeId:'',managerId:'',templateId:role.id,preserveRoleDefinition:true}
}
export function withEmployee(draft, employee) {
  if (!employee) return {...draft,employeeId:'',managerId:'',reportsToTitle:''}
  const same=String(employee.id)===String(draft.employeeId)
  return {...draft,creationMode:'EMPLOYEE',employeeId:employee.id,departmentId:employee.departmentId||'',managerId:employee.reportingManagerId||'',reportsToTitle:employee.reportingManagerName||'',
    title:draft.preserveRoleDefinition?draft.title:(employee.jobPositionName||draft.title||''),
    responsibilities:(draft.responsibilities||[]).map(({id,...row})=>({...row,accountableEmployeeId:employee.id})),
    kpis:same?draft.kpis:draft.preserveRoleDefinition?reusableDefinition(draft).kpis:[],
  }
}
export function seedResponsibilities(statements) {
  const rows=statements.filter(Boolean).slice(0,20)
  return rows.map((statement,index)=>({statement,accountableEmployeeId:null,priority:'HIGH',frequency:'Monthly',evidenceRequired:'Completion and acceptance evidence',weight:Math.floor(100/rows.length)+(index<100%rows.length?1:0)}))
}

export const INDUSTRY_OPTIONS = [
  // Primary client & platform industries
  'Insurance Companies',
  'Clinics',
  'Software Development',
  'Trading',
  'Insurance',
  'Healthcare & Clinics',
  'Technology & Software Development',
  'General Trading & Wholesale',

  // Technology, IT & Engineering
  'Information Technology & Services',
  'Cloud & DevOps Engineering',
  'Cybersecurity & Network Solutions',
  'Artificial Intelligence & Data Analytics',
  'Smart Home & IoT Automation',
  'Telecommunications',

  // Medical, Healthcare & Life Sciences
  'Medical Centers & Polyclinics',
  'Hospitals & Healthcare Systems',
  'Dental & Dermatology Clinics',
  'Pharmaceuticals & Biotechnology',
  'Medical Equipment & Supplies',

  // Financial Services & Insurance
  'Insurance Brokers & Underwriting',
  'Banking & Financial Institutions',
  'Fintech & Digital Payments',
  'Investment, Wealth & Asset Management',
  'Accounting, Audit & Tax Advisory',

  // Commerce, Retail & Merchandising
  'Import / Export & Commodity Trading',
  'Retail & E-commerce',
  'Corporate Gifting & Merchandising',
  'FMCG & Consumer Goods',
  'Luxury Goods & Jewelry',

  // Professional & Corporate Services
  'Professional Services & Management Consulting',
  'Legal Services & Corporate Governance',
  'Human Resources & Recruitment',
  'Marketing, Advertising & PR',
  'Media, Entertainment & Creative Arts',

  // Real Estate, Construction & Property
  'Real Estate & Property Management',
  'Construction, Contracting & Civil Engineering',
  'Architecture & Interior Design',
  'Facility Management & Building Maintenance',

  // Logistics & Supply Chain
  'Logistics, Freight Forwarding & Supply Chain',
  'Warehousing & Distribution',
  'Automotive & Vehicle Dealerships',
  'Aviation, Marine & Maritime Shipping',

  // Hospitality, Food & Events
  'Hospitality, Hotels & Resorts',
  'Restaurants, Catering & F&B',
  'Events, Exhibitions & Entertainment',
  'Travel, Tourism & Leisure',

  // Industrial, Energy & Manufacturing
  'Manufacturing & Industrial Production',
  'Oil, Gas & Petrochemicals',
  'Renewable Energy & Utilities',
  'Chemicals & Plastics',

  // Education, Non-Profit & Community
  'Education, Schools & Universities',
  'Training, Coaching & EdTech',
  'Non-Profit, NGO & Social Enterprises',
  'Government & Public Sector',
  'Agriculture & AgTech',
  'Security Services & Surveillance',
  'Other'
];
