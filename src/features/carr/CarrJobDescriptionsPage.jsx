import { useEffect, useState, useMemo, useRef } from 'react'
import {
  FileText,
  Pencil,
  Plus,
  X,
  Search,
  Users,
  UserCheck,
  Globe,
  Briefcase,
  MapPin,
  Clock,
  GraduationCap,
  DollarSign,
  Copy,
  Printer,
  Trash2,
  CheckCircle,
  Eye,
  Building,
  Sparkles,
  Check,
  Upload,
  Target,
  ChevronRight,
  TrendingUp,
  Award,
  Layers,
  ArrowRight,
  UserPlus
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import {assignmentDates} from './carr-editing.js'

const list = d => (Array.isArray(d) ? d : d?.content || [])

const blank = {
  id: null,
  title: '',
  jobRoleId: '',
  departmentId: '',
  reportsToTitle: '',
  targetAudience: 'BOTH', // 'INTERNAL' | 'EXTERNAL' | 'BOTH'
  status: 'ACTIVE',       // 'ACTIVE' | 'DRAFT' | 'CLOSED'
  purpose: '',
  scope: '',
  competencies: '',
  employmentType: 'FULL_TIME',
  workMode: 'ONSITE',
  location: 'Dubai, UAE',
  experienceMinYears: 2,
  experienceMaxYears: 5,
  educationLevel: "Bachelor's Degree",
  requiredSkills: '',
  preferredSkills: '',
  salaryMin: '',
  salaryMax: '',
  salaryBenchmarkMin: '',
  salaryBenchmarkMedian: '',
  salaryBenchmarkMax: '',
  salaryCurrency: 'AED',
  salaryFrequency: 'MONTHLY',
  showSalaryPublicly: false,
  benefitsSummary: 'UAE Employment Visa, Comprehensive Medical Insurance, Annual Flight Allowance, Paid Annual Leave, Performance Bonus',
  vacancyCount: 1,
  applicationInstructions: 'Apply with CV and portfolio to careers@grecha.ai',
  kpis: []
}

export default function CarrJobDescriptionsPage() {
  const [templates, setTemplates] = useState([])
  const [roles, setRoles] = useState([])
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])
  const [catalogEntries, setCatalogEntries] = useState([])
  const [reviewFrequency,setReviewFrequency]=useState('Quarterly')

  const [loading, setLoading] = useState(true)
  // Initialize form state before any effect dependency array reads it.
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blank)
  const [previewItem, setPreviewItem] = useState(null)
  const [copied, setCopied] = useState(false)
  const [benchmark, setBenchmark] = useState(null)
  const [loadingBenchmark, setLoadingBenchmark] = useState(false)
  const [assignModalTemplate, setAssignModalTemplate] = useState(null)
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    managerId: '',
    assignmentType: 'PROBATION',
    effectiveFrom: '',
    effectiveTo: '',
    nextReviewDate: '',
    notes: ''
  })
  const [assigning, setAssigning] = useState(false)

  const openAssignModal = tpl => {
    setAssignModalTemplate(tpl)
    setAssignForm({
      employeeId: '',
      managerId: '',
      assignmentType: 'PROBATION',
      effectiveFrom: '',
      effectiveTo: '',
      nextReviewDate: '',
      notes: ''
    })
  }

  const handleAssignmentTypeToggle = type => {
    const emp=employees.find(e=>String(e.id)===String(assignForm.employeeId))
    setAssignForm(prev => ({
      ...prev,
      assignmentType: type,
      ...assignmentDates(emp,type,prev.effectiveFrom,reviewFrequency)
    }))
  }

  const handleAssignEmployeeSelect = e => {
    const empId = e.target.value
    const emp = employees.find(x => String(x.id) === String(empId))
    setAssignForm(prev => ({
      ...prev,
      employeeId: empId,
      managerId: emp?.reportingManagerId ? String(emp.reportingManagerId) : prev.managerId,
      ...assignmentDates(emp,prev.assignmentType,emp?.dateJoining,reviewFrequency)
    }))
  }

  const handleAssignSubmit = async e => {
    e.preventDefault()
    if (!assignForm.employeeId) {
      toast.error('Please select an employee to assign this CAR')
      return
    }
    try {
      setAssigning(true)
      await api.post(`/carr/templates/${assignModalTemplate.id}/assign`, {
        employeeId: Number(assignForm.employeeId),
        managerId: assignForm.managerId ? Number(assignForm.managerId) : null,
        assignmentType: assignForm.assignmentType,
        effectiveFrom: assignForm.effectiveFrom || null,
        effectiveTo: assignForm.effectiveTo || null,
        nextReviewDate: assignForm.nextReviewDate || null,
        notes: assignForm.notes || null
      })
      const emp = employees.find(x => String(x.id) === String(assignForm.employeeId))
      const empName = emp ? (emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()) : 'Employee'
      toast.success(`CAR & KPIs successfully assigned to ${empName} for ${assignForm.assignmentType === 'PROBATION' ? 'Probation Evaluation' : 'Performance Management'}!`)
      setAssignModalTemplate(null)
      if (previewItem && previewItem.id === assignModalTemplate.id) {
        setPreviewItem(null)
      }
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign CAR to employee')
    } finally {
      setAssigning(false)
    }
  }
  const benchmarkTimeoutRef = useRef(null)

  const fetchSalaryBenchmark = async (overrideTitle, overrideMinExp, overrideMaxExp, overrideCurr, overrideFreq, overrideLoc, overrideSalMin, overrideSalMax) => {
    const t = (overrideTitle !== undefined ? overrideTitle : form.title || '').trim()
    if (!t) {
      setBenchmark(null)
      return
    }
    try {
      setLoadingBenchmark(true)
      const res = await api.post('/carr/salary-benchmark', {
        title: t,
        experienceMinYears: Number(overrideMinExp !== undefined ? overrideMinExp : form.experienceMinYears) || 0,
        experienceMaxYears: Number(overrideMaxExp !== undefined ? overrideMaxExp : form.experienceMaxYears) || 0,
        currency: overrideCurr || form.salaryCurrency || 'AED',
        frequency: overrideFreq || form.salaryFrequency || 'MONTHLY',
        location: overrideLoc !== undefined ? overrideLoc : form.location || 'Dubai, UAE',
        currentSalaryMin: Number(overrideSalMin !== undefined ? overrideSalMin : form.salaryMin) || null,
        currentSalaryMax: Number(overrideSalMax !== undefined ? overrideSalMax : form.salaryMax) || null
      })
      setBenchmark(res.data)
    } catch (err) {
      console.warn('Salary benchmark fetch error:', err)
    } finally {
      setLoadingBenchmark(false)
    }
  }

  useEffect(() => {
    if (!showForm || !form.title) return
    if (benchmarkTimeoutRef.current) clearTimeout(benchmarkTimeoutRef.current)
    benchmarkTimeoutRef.current = setTimeout(() => {
      fetchSalaryBenchmark()
    }, 400)
    return () => {
      if (benchmarkTimeoutRef.current) clearTimeout(benchmarkTimeoutRef.current)
    }
  }, [
    showForm,
    form.title,
    form.experienceMinYears,
    form.experienceMaxYears,
    form.salaryCurrency,
    form.salaryFrequency,
    form.location,
    form.salaryMin,
    form.salaryMax
  ])

  const applyBenchmark = () => {
    if (!benchmark) return
    setForm(prev => ({
      ...prev,
      salaryMin: benchmark.percentile25 ?? prev.salaryMin,
      salaryMax: benchmark.percentile75 ?? prev.salaryMax,
      salaryBenchmarkMin: benchmark.percentile25,
      salaryBenchmarkMedian: benchmark.percentile50,
      salaryBenchmarkMax: benchmark.percentile75
    }))
    toast.success(
      `Applied illustrative estimate: ${benchmark.currency} ${Number(benchmark.percentile25).toLocaleString()} - ${Number(benchmark.percentile75).toLocaleString()}`
    )
  }
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [generatingKpis, setGeneratingKpis] = useState(false)
  const [uploadingJd, setUploadingJd] = useState(false)

  // Filters & search
  const [audienceFilter, setAudienceFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const fileInputRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const [tRes, jRes, dRes, cRes] = await Promise.all([
        api.get('/carr/templates'),
        api.get('/job-roles'),
        api.get('/departments', { params: { size: 200 } }).catch(() => ({ data: [] })),
        api.get('/carr/creation-context').catch(() => ({ data: {} }))
      ])
      setTemplates(list(tRes.data))
      setRoles(list(jRes.data))
      setDepartments(list(dRes.data))
      if (cRes.data) {
        setReviewFrequency(cRes.data.reviewFrequency||'Quarterly')
        setEmployees(cRes.data.employees || [])
        setCatalogEntries(cRes.data.jobTitles || [])
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to load job descriptions and roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Stats calculation
  const stats = useMemo(() => {
    const total = templates.length
    const hiring = templates.filter(t => t.targetAudience === 'EXTERNAL' || t.targetAudience === 'BOTH').length
    const internal = templates.filter(t => t.targetAudience === 'INTERNAL' || t.targetAudience === 'BOTH').length
    const vacancies = templates
      .filter(t => (t.targetAudience === 'EXTERNAL' || t.targetAudience === 'BOTH') && t.status !== 'CLOSED')
      .reduce((sum, t) => sum + (Number(t.vacancyCount) || 1), 0)
    return { total, hiring, internal, vacancies }
  }, [templates])

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (audienceFilter !== 'ALL') {
        const aud = t.targetAudience || 'BOTH'
        if (audienceFilter === 'EXTERNAL' && aud !== 'EXTERNAL' && aud !== 'BOTH') return false
        if (audienceFilter === 'INTERNAL' && aud !== 'INTERNAL' && aud !== 'BOTH') return false
        if (audienceFilter === 'BOTH' && aud !== 'BOTH') return false
      }
      if (statusFilter !== 'ALL' && (t.status || 'ACTIVE') !== statusFilter) return false
      if (deptFilter !== 'ALL' && String(t.departmentId) !== String(deptFilter)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const text = [
          t.title,
          t.reportsToTitle,
          t.jobRoleName,
          t.departmentName,
          t.purpose,
          t.requiredSkills,
          t.preferredSkills,
          t.location
        ].filter(Boolean).join(' ').toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [templates, audienceFilter, statusFilter, deptFilter, searchQuery])

  const edit = t => {
    let parsedKpis = []
    if (t.draftContent) {
      try {
        const parsed = JSON.parse(t.draftContent)
        if (Array.isArray(parsed.kpis)) parsedKpis = parsed.kpis
      } catch (e) {}
    }

    setForm({
      id: t.id,
      title: t.title || '',
      jobRoleId: t.jobRoleId ? String(t.jobRoleId) : '',
      departmentId: t.departmentId ? String(t.departmentId) : '',
      reportsToTitle: t.reportsToTitle || '',
      targetAudience: t.targetAudience || 'BOTH',
      status: t.status || 'ACTIVE',
      purpose: t.purpose || '',
      scope: t.scope || '',
      competencies: t.competencies || '',
      employmentType: t.employmentType || 'FULL_TIME',
      workMode: t.workMode || 'ONSITE',
      location: t.location || 'Dubai, UAE',
      experienceMinYears: t.experienceMinYears != null ? t.experienceMinYears : 2,
      experienceMaxYears: t.experienceMaxYears != null ? t.experienceMaxYears : 5,
      educationLevel: t.educationLevel || "Bachelor's Degree",
      requiredSkills: t.requiredSkills || '',
      preferredSkills: t.preferredSkills || '',
      salaryMin: t.salaryMin != null ? String(t.salaryMin) : '',
      salaryMax: t.salaryMax != null ? String(t.salaryMax) : '',
      salaryCurrency: t.salaryCurrency || 'AED',
      salaryFrequency: t.salaryFrequency || 'MONTHLY',
      showSalaryPublicly: Boolean(t.showSalaryPublicly),
      benefitsSummary: t.benefitsSummary || 'UAE Employment Visa, Comprehensive Medical Insurance, Annual Flight Allowance, Paid Annual Leave, Performance Bonus',
      vacancyCount: t.vacancyCount != null ? t.vacancyCount : 1,
      applicationInstructions: t.applicationInstructions || 'Apply with CV and portfolio to careers@grecha.ai',
      kpis: parsedKpis
    })
    setShowForm(true)
  }

  // 1. AUTO-GENERATE JD (AI & Catalog Assisted)
  const autoGenerateJd = (targetTitle) => {
    const t = (targetTitle || form.title || '').trim()
    if (!t) {
      toast.error('Please enter or select a Job Position first (e.g. Sales Manager)')
      return
    }

    // Match catalog or generate standard specs
    const catalogMatch = catalogEntries.find(
      c => c.name.toLowerCase() === t.toLowerCase() || t.toLowerCase().includes(c.name.toLowerCase())
    )

    let generatedPurpose = ''
    let generatedResponsibilities = []
    let generatedCompetencies = ''
    let generatedSkills = ''

    if (catalogMatch) {
      generatedPurpose = catalogMatch.purpose
      generatedResponsibilities = catalogMatch.responsibilities || []
      generatedCompetencies = 'Accountability, Clear Communication, Strategic Execution, Collaboration'
      generatedSkills = `${t}, Core Domain Strategy, Pipeline Management, Stakeholder Collaboration`
    } else {
      const isSales = /sales|business dev|account|commercial/i.test(t)
      const isTech = /engineer|developer|software|tech|architect|data|devops/i.test(t)
      const isMarketing = /marketing|brand|seo|growth|content/i.test(t)
      const isFinance = /finance|account|payroll|audit/i.test(t)

      if (isSales) {
        generatedPurpose = `Lead sales growth, prospect acquisition, and revenue quota delivery for the organization.`
        generatedResponsibilities = [
          'Develop and execute outbound and inbound sales plans to achieve agreed revenue quotas',
          'Identify, qualify, and close high-value customer and partner opportunities',
          'Manage the end-to-end sales pipeline and maintain CRM data accuracy',
          'Negotiate contracts and commercial terms with key prospective clients',
          'Coordinate customer commitments and ensure smooth onboarding transitions'
        ]
        generatedCompetencies = 'Commercial Negotiation, Pipeline Forecasting, Relationship Building, Tenacity'
        generatedSkills = 'B2B Sales, CRM Software (Salesforce/HubSpot), Contract Negotiation, Deal Closing'
      } else if (isTech) {
        generatedPurpose = `Design, build, and maintain robust, high-performance software systems aligned with technical standards.`
        generatedResponsibilities = [
          'Architect and deliver reliable, scalable software services and applications',
          'Participate in architecture design, code reviews, and technical documentation',
          'Ensure high availability, test automation, and code security compliance',
          'Resolve complex technical defects and maintain production performance'
        ]
        generatedCompetencies = 'System Architecture, Code Quality, Problem Solving, Continuous Learning'
        generatedSkills = 'Full-Stack Development, APIs, Cloud Infrastructure, Database Optimization'
      } else {
        generatedPurpose = `Own key operational deliverables and drive high-standard execution for the ${t} function.`
        generatedResponsibilities = [
          `Lead the core daily and strategic responsibilities of the ${t} position`,
          'Ensure operational excellence, on-time delivery, and team SLA compliance',
          'Partner with cross-functional stakeholders to resolve process bottlenecks',
          'Maintain accurate reporting, documentation, and performance records'
        ]
        generatedCompetencies = 'Ownership, Operational Discipline, Clear Communication, Leadership'
        generatedSkills = `${t}, Workflow Optimization, Stakeholder Management, Reporting`
      }
    }

    const scopeText = generatedResponsibilities.join('\n')
    setForm(prev => ({
      ...prev,
      purpose: generatedPurpose,
      scope: scopeText,
      competencies: generatedCompetencies,
      requiredSkills: prev.requiredSkills || generatedSkills
    }))

    toast.success(`Job Description generated for ${t}! Automatically generating KPIs...`)
    // Automatically generate KPIs
    autoGenerateKpis(t, generatedResponsibilities)
  }

  // 2. UPLOAD JD DOCUMENT (.docx, .pdf, .txt, .md)
  const handleUploadJd = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingJd(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/carr/job-description/extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const text = res.data?.text || ''
      if (!text.trim()) {
        toast.error('Could not extract text from this document.')
        return
      }

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      const titleCandidate = lines[0]?.length < 60 ? lines[0] : ''
      const bulletLines = lines.filter(l => /^[-•*\d.)]/.test(l) || (l.length > 25 && l.length < 200))
      const cleanBullets = (bulletLines.length ? bulletLines : lines.slice(1, 8))
        .map(l => l.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter(Boolean)

      const scopeText = cleanBullets.join('\n')
      const purposeText = lines.slice(0, 3).join(' ').slice(0, 500)
      const detectedTitle = form.title || titleCandidate || 'New Position'

      setForm(prev => ({
        ...prev,
        title: detectedTitle,
        purpose: purposeText || prev.purpose,
        scope: scopeText || prev.scope
      }))

      toast.success('Document imported! Now auto-generating KPIs...')
      autoGenerateKpis(detectedTitle, cleanBullets)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to extract file')
    } finally {
      setUploadingJd(false)
      e.target.value = ''
    }
  }

  // 3. AUTO-GENERATE KPIS FOR THIS ROLE
  const autoGenerateKpis = async (roleTitle, responsibilitiesList) => {
    const title = (roleTitle || form.title || '').trim()
    const stmts = Array.isArray(responsibilitiesList) && responsibilitiesList.length
      ? responsibilitiesList
      : form.scope.split('\n').map(s => s.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean)

    if (!title) {
      toast.error('Please specify a Job Title first')
      return
    }
    if (!stmts.length) {
      toast.error('Add at least 1-2 responsibilities before generating KPIs')
      return
    }

    setGeneratingKpis(true)
    try {
      const today = new Date()
      const year = today.getFullYear()
      const effectiveFrom = today.toISOString().slice(0, 10)
      const effectiveTo = `${year}-12-31`

      const payload = {
        title,
        responsibilities: stmts.slice(0, 5),
        effectiveFrom,
        effectiveTo
      }

      const res = await api.post('/carr/role-kpi-suggestions', payload)
      const suggestions = res.data || []
      setForm(prev => ({
        ...prev,
        kpis: suggestions
      }))
      toast.success(`${suggestions.length} KPIs automatically generated for ${title}!`)
    } catch (err) {
      // Robust client-side generator if suggestion endpoint fails
      const fallbackKpis = stmts.slice(0, 4).map((stmt, idx, arr) => ({
        id: null,
        name: `On-time completion: ${stmt.length > 55 ? stmt.slice(0, 55) + '...' : stmt}`,
        type: 'KPI',
        direction: 'INCREASE',
        targetValue: 100,
        actualValue: null,
        unit: '%',
        weight: Math.floor(100 / arr.length) + (idx < 100 % arr.length ? 1 : 0),
        dueDate: `${new Date().getFullYear()}-12-31`,
        dataSource: 'MANUAL',
        reviewFrequency: 'Monthly',
        metricDefinition: `Manager-accepted deliverable completion rate for "${stmt}" / all agreed deliverables due within review period × 100.`
      }))
      setForm(prev => ({
        ...prev,
        kpis: fallbackKpis
      }))
      toast.success(`${fallbackKpis.length} KPIs generated for ${title}!`)
    } finally {
      setGeneratingKpis(false)
    }
  }

  const handleDelete = async id => {
    if (!window.confirm('Are you sure you want to archive this Job Description?')) return
    setDeletingId(id)
    try {
      await api.delete(`/carr/templates/${id}`)
      toast.success('Job description archived')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to archive job description')
    } finally {
      setDeletingId(null)
    }
  }

  const submit = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      // Build draftContent containing role definition & KPIs
      const cleanResponsibilities = form.scope
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => ({
          id: null,
          statement: s,
          accountableEmployeeId: null,
          priority: 'HIGH',
          frequency: 'Monthly',
          evidenceRequired: 'Agreed milestone outcome evidence',
          weight: Math.floor(100 / (form.scope.split('\n').filter(Boolean).length || 1))
        }))

      const draftContent = JSON.stringify({
        title: form.title.trim(),
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        purpose: form.purpose,
        reportsToTitle: form.reportsToTitle,
        responsibilities: cleanResponsibilities,
        kpis: form.kpis || [],
        rewards: []
      })

      const payload = {
        title: form.title.trim(),
        jobRoleId: form.jobRoleId ? Number(form.jobRoleId) : null,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        reportsToTitle: form.reportsToTitle,
        targetAudience: form.targetAudience,
        status: form.status,
        purpose: form.purpose,
        scope: form.scope,
        competencies: form.competencies,
        employmentType: form.employmentType,
        workMode: form.workMode,
        location: form.location,
        experienceMinYears: form.experienceMinYears !== '' ? Number(form.experienceMinYears) : null,
        experienceMaxYears: form.experienceMaxYears !== '' ? Number(form.experienceMaxYears) : null,
        educationLevel: form.educationLevel,
        requiredSkills: form.requiredSkills,
        preferredSkills: form.preferredSkills,
        salaryMin: form.salaryMin !== '' ? Number(form.salaryMin) : null,
        salaryMax: form.salaryMax !== '' ? Number(form.salaryMax) : null,
        salaryCurrency: form.salaryCurrency,
        salaryFrequency: form.salaryFrequency,
        showSalaryPublicly: Boolean(form.showSalaryPublicly),
        benefitsSummary: form.benefitsSummary,
        vacancyCount: form.vacancyCount !== '' ? Number(form.vacancyCount) : 1,
        applicationInstructions: form.applicationInstructions,
        draftContent
      }

      if (form.id) {
        await api.put(`/carr/templates/${form.id}`, payload)
        toast.success('Job description updated successfully')
      } else {
        await api.post('/carr/templates', payload)
        toast.success('Job description & Role KPIs created successfully')
      }
      setForm(blank)
      setShowForm(false)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save job description')
    } finally {
      setSaving(false)
    }
  }

  const copyForJobBoard = item => {
    if (!item) return
    const formatBullets = text =>
      (text || '')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => (s.startsWith('•') || s.startsWith('-') ? s : `• ${s}`))
        .join('\n')

    const lines = [
      `Position: ${item.title}`,
      `Department: ${item.departmentName || 'General'}`,
      item.reportsToTitle ? `Reports To: ${item.reportsToTitle}` : null,
      `Location: ${item.location || 'UAE'} (${formatWorkMode(item.workMode)})`,
      `Employment Type: ${formatEmploymentType(item.employmentType)}`,
      item.vacancyCount ? `Open Vacancies: ${item.vacancyCount}` : null,
      item.showSalaryPublicly && item.salaryMin && item.salaryMax
        ? `Salary Range: ${item.salaryCurrency} ${Number(item.salaryMin).toLocaleString()} - ${Number(item.salaryMax).toLocaleString()} / ${item.salaryFrequency ? item.salaryFrequency.toLowerCase() : 'month'}`
        : null,
      '',
      'ABOUT THE ROLE',
      '----------------------------------------',
      item.purpose || 'Deliver strategic value and contribute directly to company objectives.',
      '',
      'KEY RESPONSIBILITIES',
      '----------------------------------------',
      formatBullets(item.scope) || '• Lead core operational and functional responsibilities.',
      '',
      'REQUIRED QUALIFICATIONS & SKILLS',
      '----------------------------------------',
      item.experienceMinYears
        ? `• Experience: ${item.experienceMinYears}${item.experienceMaxYears ? ` - ${item.experienceMaxYears}` : '+'} years of relevant industry experience.`
        : null,
      item.educationLevel ? `• Education: ${item.educationLevel}` : null,
      formatBullets(item.requiredSkills),
      item.competencies ? `• Competencies: ${item.competencies}` : null,
      '',
      item.preferredSkills
        ? `PREFERRED QUALIFICATIONS\n----------------------------------------\n${formatBullets(item.preferredSkills)}\n`
        : null,
      item.benefitsSummary
        ? `WHAT WE OFFER & BENEFITS\n----------------------------------------\n${formatBullets(item.benefitsSummary)}\n`
        : null,
      'HOW TO APPLY',
      '----------------------------------------',
      item.applicationInstructions || 'Please apply via careers@grecha.ai with your updated resume and portfolio.'
    ]
      .filter(line => line !== null)
      .join('\n')

    navigator.clipboard.writeText(lines)
    setCopied(true)
    toast.success('Job description formatted & copied for LinkedIn / Job Board!')
    setTimeout(() => setCopied(false), 2500)
  }

  const formatEmploymentType = val => {
    switch (val) {
      case 'FULL_TIME': return 'Full-time'
      case 'PART_TIME': return 'Part-time'
      case 'CONTRACT': return 'Contract'
      case 'INTERNSHIP': return 'Internship'
      default: return val || 'Full-time'
    }
  }

  const formatWorkMode = val => {
    switch (val) {
      case 'ONSITE': return 'On-site'
      case 'HYBRID': return 'Hybrid'
      case 'REMOTE': return 'Remote'
      default: return val || 'On-site'
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-9">
      {/* Hidden file input for JD document upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.pdf,.txt,.md"
        onChange={handleUploadJd}
        className="hidden"
      />

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1767c7]">
            <Sparkles size={14} className="text-[#1767c7]" />
            Dual-Mode Job Description & CAR Engine
          </div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#061d3d] lg:text-4xl">
            Job Descriptions & Roles
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-500">
            Define comprehensive Job Descriptions for <b>Unfilled / External Roles</b> (upload or auto-generate JD, set reporting manager, and automatically create KPIs) and <b>Inside Employee CARs</b>.
          </p>
        </div>
        <button
          onClick={() => {
            setForm(blank)
            setShowForm(true)
          }}
          className="flex items-center gap-2 rounded-lg bg-[#061d3d] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b2954]"
        >
          <Plus size={18} />
          Create Job Description
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Total Positions</span>
            <span className="rounded-lg bg-blue-50 p-2 text-[#1767c7]"><Briefcase size={18} /></span>
          </div>
          <div className="mt-3 text-2xl font-bold text-[#061d3d]">{stats.total}</div>
          <p className="mt-1 text-xs text-slate-400">Total role definitions</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">External Hiring JDs</span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><Globe size={18} /></span>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-700">{stats.hiring}</div>
          <p className="mt-1 text-xs text-slate-400">Ready for job boards & recruitment</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Open Vacancies</span>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-600"><Users size={18} /></span>
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-700">{stats.vacancies}</div>
          <p className="mt-1 text-xs text-slate-400">Total active seats to fill</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Internal CAR Roles</span>
            <span className="rounded-lg bg-purple-50 p-2 text-purple-600"><UserCheck size={18} /></span>
          </div>
          <div className="mt-3 text-2xl font-bold text-purple-700">{stats.internal}</div>
          <p className="mt-1 text-xs text-slate-400">Linked to employee performance agreements</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Audience Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1 text-xs font-medium text-slate-600">
            {[
              { id: 'ALL', label: 'All Roles', count: templates.length },
              { id: 'EXTERNAL', label: 'Outside Hiring JDs', count: stats.hiring },
              { id: 'INTERNAL', label: 'Inside Employee CAR', count: stats.internal },
              { id: 'BOTH', label: 'Dual-Purpose', count: templates.filter(t => (t.targetAudience || 'BOTH') === 'BOTH').length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAudienceFilter(tab.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                  audienceFilter === tab.id
                    ? 'bg-white font-bold text-[#061d3d] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  audienceFilter === tab.id ? 'bg-[#1767c7] text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Department & Status & Search Filters */}
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search position, reports to, skills..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#1767c7] focus:outline-none"
              />
            </div>

            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-[#1767c7] focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-[#1767c7] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Cards */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#1767c7] border-r-transparent" />
          <p className="mt-3 text-sm text-slate-500">Loading Job Descriptions & Roles…</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-50 text-slate-400">
            <Briefcase size={26} />
          </div>
          <h3 className="mt-4 font-serif text-lg font-bold text-slate-800">No Job Descriptions Found</h3>
          <p className="mt-1 text-sm text-slate-500">
            {searchQuery || audienceFilter !== 'ALL' || deptFilter !== 'ALL'
              ? 'Try adjusting your filters or search keywords.'
              : 'Create a Job Description for inside employees or unfilled external roles.'}
          </p>
          <button
            onClick={() => {
              setForm(blank)
              setShowForm(true)
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#061d3d] px-4 py-2 text-xs font-semibold text-white shadow-xs"
          >
            <Plus size={16} />
            Create Job Description
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map(t => {
            const isExternal = t.targetAudience === 'EXTERNAL' || t.targetAudience === 'BOTH'
            const skillsList = (t.requiredSkills || '')
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
              .slice(0, 4)

            // Check if KPIs are saved in draftContent
            let kpiCount = 0
            if (t.draftContent) {
              try {
                const parsed = JSON.parse(t.draftContent)
                if (Array.isArray(parsed.kpis)) kpiCount = parsed.kpis.length
              } catch (e) {}
            }

            return (
              <article
                key={t.id}
                className="group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-[#1767c7]/50 hover:shadow-md"
              >
                <div>
                  {/* Card Header: Audience & Status Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {t.targetAudience === 'EXTERNAL' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <Globe size={11} /> Outside Hiring JD
                        </span>
                      )}
                      {t.targetAudience === 'INTERNAL' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                          <UserCheck size={11} /> Inside Employee CAR
                        </span>
                      )}
                      {(!t.targetAudience || t.targetAudience === 'BOTH') && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700">
                          <Sparkles size={11} /> Dual-Purpose (In & Out)
                        </span>
                      )}

                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        t.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.status === 'DRAFT'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t.status || 'ACTIVE'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreviewItem(t)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-[#1767c7]"
                        title="View & Export JD"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => edit(t)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-[#1767c7]"
                        title="Edit Job Description"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={deletingId === t.id}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Archive"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Metadata */}
                  <h3 className="mt-3.5 font-serif text-lg font-bold text-[#071f49] transition group-hover:text-[#1767c7]">
                    {t.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {t.departmentName && (
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Building size={12} className="text-slate-400" />
                        {t.departmentName}
                      </span>
                    )}
                    {t.departmentName && t.jobRoleName && <span>·</span>}
                    {t.jobRoleName && (
                      <span className="text-[#1767c7] font-medium">{t.jobRoleName}</span>
                    )}
                  </div>

                  {/* Reporting to highlight */}
                  {t.reportsToTitle && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-600">
                      <span className="font-semibold text-slate-500">Reports To:</span>
                      <span className="font-medium text-slate-800">{t.reportsToTitle}</span>
                    </div>
                  )}

                  {/* Recruitment Specs Pill Row */}
                  {isExternal && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                      {t.workMode && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium">
                          {formatWorkMode(t.workMode)}
                        </span>
                      )}
                      {t.employmentType && (
                        <span className="rounded bg-slate-100 px-2 py-0.5">
                          {formatEmploymentType(t.employmentType)}
                        </span>
                      )}
                      {t.location && (
                        <span className="flex items-center gap-0.5 text-slate-500">
                          <MapPin size={11} /> {t.location}
                        </span>
                      )}
                      {t.experienceMinYears != null && (
                        <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                          {t.experienceMinYears}{t.experienceMaxYears ? `-${t.experienceMaxYears}` : '+'} yrs exp
                        </span>
                      )}
                      {t.vacancyCount && (
                        <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                          {t.vacancyCount} {t.vacancyCount === 1 ? 'Vacancy' : 'Vacancies'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Salary Badge if public */}
                  {isExternal && t.showSalaryPublicly && (t.salaryMin || t.salaryMax) && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <DollarSign size={13} className="text-emerald-600" />
                      {t.salaryCurrency || 'AED'} {t.salaryMin ? Number(t.salaryMin).toLocaleString() : '0'}
                      {t.salaryMax ? ` - ${Number(t.salaryMax).toLocaleString()}` : '+'} / {t.salaryFrequency ? t.salaryFrequency.toLowerCase() : 'month'}
                    </div>
                  )}

                  {/* Purpose Snippet */}
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">
                    {t.purpose || 'Role purpose has not been defined yet.'}
                  </p>

                  {/* KPIs configured pill */}
                  {kpiCount > 0 && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50/70 px-2.5 py-1 text-xs font-semibold text-purple-800">
                      <Target size={13} className="text-purple-600" />
                      {kpiCount} Performance KPIs Generated
                    </div>
                  )}

                  {/* Skills Pills */}
                  {skillsList.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {skillsList.map((skill, idx) => (
                        <span
                          key={idx}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                  <span className="text-[11px]">Version {t.version || 1}</span>
                  {t.status!=='CLOSED'&&<button type="button" onClick={()=>openAssignModal(t)} className="font-semibold text-[#1767c7]">Assign to employee</button>}
                  <button
                    onClick={() => setPreviewItem(t)}
                    className="flex items-center gap-1 font-semibold text-[#1767c7] transition hover:text-[#0b2954]"
                  >
                    View & Share JD
                    <Eye size={13} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Comprehensive Dual-Mode Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative my-8 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1767c7]">
                  {form.id ? 'Edit Specification' : 'New Role Specification'}
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#061d3d]">
                  {form.id ? 'Update Job Description & Role' : 'Create Job Description & KPIs'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Action Ribbon: Upload JD or Auto-Generate */}
            <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-purple-50/80 border-b border-slate-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-bold text-[#061d3d]">Quick JD Builders:</span>
                Upload a document or auto-generate for a new unfilled position (e.g. Sales Manager).
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={uploadingJd}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition disabled:opacity-50"
                >
                  <Upload size={14} className="text-[#1767c7]" />
                  {uploadingJd ? 'Extracting File…' : 'Upload JD Document'}
                </button>

                <button
                  type="button"
                  onClick={() => autoGenerateJd()}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1767c7] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#1253a2] transition"
                >
                  <Sparkles size={14} />
                  Auto-Generate JD & KPIs
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={submit} className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
              {/* Audience Segmented Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Target Audience & Intended Use <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, targetAudience: 'INTERNAL' })}
                    className={`flex flex-col text-left rounded-xl border p-4 transition ${
                      form.targetAudience === 'INTERNAL'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-blue-700">
                        <UserCheck size={18} />
                      </span>
                      {form.targetAudience === 'INTERNAL' && <Check size={18} className="text-blue-600" />}
                    </div>
                    <div className="mt-3 font-semibold text-sm text-slate-900">Inside Employee (CAR)</div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      For internal performance agreements, role clarity, deliverables, and KPI scoring.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, targetAudience: 'EXTERNAL' })}
                    className={`flex flex-col text-left rounded-xl border p-4 transition ${
                      form.targetAudience === 'EXTERNAL'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                        <Globe size={18} />
                      </span>
                      {form.targetAudience === 'EXTERNAL' && <Check size={18} className="text-emerald-600" />}
                    </div>
                    <div className="mt-3 font-semibold text-sm text-slate-900">Outside Candidate (Hiring)</div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      For public recruitment, job boards, qualifications, vacancies, and compensation.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, targetAudience: 'BOTH' })}
                    className={`flex flex-col text-left rounded-xl border p-4 transition ${
                      form.targetAudience === 'BOTH'
                        ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-100 text-purple-700">
                        <Sparkles size={18} />
                      </span>
                      {form.targetAudience === 'BOTH' && <Check size={18} className="text-purple-600" />}
                    </div>
                    <div className="mt-3 font-semibold text-sm text-slate-900">Dual-Purpose (Both)</div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      Recruits outside talent, then directly transforms into an internal employee CAR upon hiring.
                    </p>
                  </button>
                </div>
              </div>

              {/* Section 1: Role Essentials & Reporting Hierarchy */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-[#1767c7]" />
                  1. Role Fundamentals & Reporting Structure
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Job Title / Position <span className="text-red-500">*</span>
                      <input
                        type="text"
                        required
                        list="job-titles-datalist"
                        placeholder="e.g. Sales Manager, Senior Frontend Engineer"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-[#1767c7] focus:outline-none"
                      />
                      <datalist id="job-titles-datalist">
                        {catalogEntries.map((c, i) => (
                          <option key={i} value={c.name} />
                        ))}
                      </datalist>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Who Does This Position Report To?
                      <input
                        type="text"
                        list="reports-to-datalist"
                        placeholder="e.g. Managing Director, VP of Sales, CEO"
                        value={form.reportsToTitle}
                        onChange={e => setForm({ ...form, reportsToTitle: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-[#1767c7] focus:outline-none"
                      />
                      <datalist id="reports-to-datalist">
                        <option value="Chief Executive Officer (CEO)" />
                        <option value="Managing Director" />
                        <option value="VP of Sales" />
                        <option value="Head of Engineering" />
                        <option value="Operations Director" />
                        <option value="HR Director" />
                        {employees.map(emp => (
                          <option key={emp.id} value={`${emp.fullName}${emp.jobPositionName ? ` (${emp.jobPositionName})` : ''}`} />
                        ))}
                      </datalist>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Department
                      <select
                        value={form.departmentId}
                        onChange={e => setForm({ ...form, departmentId: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1767c7] focus:outline-none"
                      >
                        <option value="">Select Department (Optional)</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Link to Existing Job Role (Optional)
                      <select
                        value={form.jobRoleId}
                        onChange={e => setForm({ ...form, jobRoleId: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1767c7] focus:outline-none"
                      >
                        <option value="">Select Company Job Role (Optional)</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Role Status
                      <select
                        value={form.status}
                        onChange={e => setForm({ ...form, status: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1767c7] focus:outline-none"
                      >
                        <option value="ACTIVE">Active (Published)</option>
                        <option value="DRAFT">Draft</option>
                        <option value="CLOSED">Closed / Filled</option>
                      </select>
                    </label>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">
                      Role Purpose & Mission (Executive Summary)
                      <textarea
                        rows={2}
                        placeholder="Explain why this position exists and what key organizational outcomes it delivers..."
                        value={form.purpose}
                        onChange={e => setForm({ ...form, purpose: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-[#1767c7] focus:outline-none"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 2: Scope & Competencies */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <UserCheck size={14} className="text-[#1767c7]" />
                    2. Roles, Scope & Competencies (CAR Alignment)
                  </h4>

                  <button
                    type="button"
                    disabled={generatingKpis}
                    onClick={() => autoGenerateKpis()}
                    className="flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 transition disabled:opacity-50"
                  >
                    <Target size={13} className="text-purple-600" />
                    {generatingKpis ? 'Generating…' : '⚡ Auto-Generate KPIs from Scope'}
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Core Responsibilities & Deliverables (One per line)
                      <p className="text-[11px] font-normal text-slate-500 mb-1">
                        Each line serves as a key responsibility on the external JD and as a measurable deliverable in the employee's CAR contract.
                      </p>
                      <textarea
                        rows={4}
                        placeholder="• Set and review monthly sales targets&#10;• Coach the sales team and conduct pipeline reviews&#10;• Drive high-value account acquisition and customer renewals"
                        value={form.scope}
                        onChange={e => setForm({ ...form, scope: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-[#1767c7] focus:outline-none"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Required Competencies & Behavioral Traits
                      <textarea
                        rows={2}
                        placeholder="Strategic thinking, Negotiation, Team leadership, Empathy, Operational rigor"
                        value={form.competencies}
                        onChange={e => setForm({ ...form, competencies: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-[#1767c7] focus:outline-none"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 3: Generated Role KPIs */}
              <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                      <Target size={15} className="text-purple-700" />
                      3. Generated Performance KPIs for this Position
                    </h4>
                    <p className="text-[11px] text-purple-700/80">
                      These measurable KPIs will be attached to the employee's CAR contract upon hiring or assignment.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={generatingKpis}
                    onClick={() => autoGenerateKpis()}
                    className="flex items-center gap-1 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-purple-800 transition disabled:opacity-50"
                  >
                    <Sparkles size={13} />
                    {generatingKpis ? 'Calculating…' : form.kpis.length ? 'Regenerate KPIs' : 'Generate KPIs'}
                  </button>
                </div>

                {form.kpis.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-purple-200 bg-white/60 p-6 text-center text-xs text-purple-700">
                    <p>No KPIs generated yet. Enter responsibilities above and click <b>Auto-Generate KPIs</b>.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-purple-900 uppercase tracking-wider px-2">
                      <div className="col-span-6">Metric Name</div>
                      <div className="col-span-2">Target</div>
                      <div className="col-span-2">Weight</div>
                      <div className="col-span-2 text-right">Cadence</div>
                    </div>

                    {form.kpis.map((kpi, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center rounded-lg border border-purple-100 bg-white p-2.5 text-xs text-slate-800 shadow-2xs"
                      >
                        <div className="col-span-6 font-medium text-slate-900">
                          {kpi.name}
                          <p className="text-[10px] text-slate-500 line-clamp-1">{kpi.metricDefinition}</p>
                        </div>
                        <div className="col-span-2 font-semibold text-emerald-700">
                          {kpi.targetValue} {kpi.unit || '%'}
                        </div>
                        <div className="col-span-2">
                          <span className="rounded bg-purple-100 px-2 py-0.5 font-bold text-purple-800">
                            {kpi.weight}%
                          </span>
                        </div>
                        <div className="col-span-2 text-right text-slate-600">
                          {kpi.reviewFrequency || 'Monthly'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 4: External Hiring Specifications (Shown when EXTERNAL or BOTH) */}
              {(form.targetAudience === 'EXTERNAL' || form.targetAudience === 'BOTH') && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-1.5">
                    <Globe size={14} className="text-emerald-700" />
                    4. Outside Candidate Recruitment Specifications
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Employment Type
                        <select
                          value={form.employmentType}
                          onChange={e => setForm({ ...form, employmentType: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                        >
                          <option value="FULL_TIME">Full-time</option>
                          <option value="PART_TIME">Part-time</option>
                          <option value="CONTRACT">Contract</option>
                          <option value="INTERNSHIP">Internship</option>
                        </select>
                      </label>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Work Mode
                        <select
                          value={form.workMode}
                          onChange={e => setForm({ ...form, workMode: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                        >
                          <option value="ONSITE">On-site</option>
                          <option value="HYBRID">Hybrid</option>
                          <option value="REMOTE">Remote</option>
                        </select>
                      </label>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Location / Work City
                        <input
                          type="text"
                          placeholder="e.g. Dubai, UAE"
                          value={form.location}
                          onChange={e => setForm({ ...form, location: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </label>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Experience (Years)
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            placeholder="Min"
                            value={form.experienceMinYears}
                            onChange={e => setForm({ ...form, experienceMinYears: e.target.value })}
                            className="w-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                          />
                          <span className="text-slate-400">-</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Max"
                            value={form.experienceMaxYears}
                            onChange={e => setForm({ ...form, experienceMaxYears: e.target.value })}
                            className="w-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                      </label>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Education Level
                        <select
                          value={form.educationLevel}
                          onChange={e => setForm({ ...form, educationLevel: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                        >
                          <option value="Bachelor's Degree">Bachelor's Degree</option>
                          <option value="Master's Degree">Master's Degree</option>
                          <option value="Diploma / Associate">Diploma / Associate</option>
                          <option value="High School">High School</option>
                          <option value="Doctorate / Ph.D.">Doctorate / Ph.D.</option>
                          <option value="Not Specified">Not Specified</option>
                        </select>
                      </label>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Open Vacancies (Count)
                        <input
                          type="number"
                          min="1"
                          placeholder="e.g. 1"
                          value={form.vacancyCount}
                          onChange={e => setForm({ ...form, vacancyCount: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none font-semibold text-emerald-800"
                        />
                      </label>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-xs font-semibold text-slate-700">
                        Required Core Skills (Comma-separated)
                        <input
                          type="text"
                          placeholder="e.g. React, Node.js, Spring Boot, PostgreSQL, Docker"
                          value={form.requiredSkills}
                          onChange={e => setForm({ ...form, requiredSkills: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </label>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-xs font-semibold text-slate-700">
                        Preferred / Bonus Skills (Comma-separated)
                        <input
                          type="text"
                          placeholder="e.g. AWS, Kubernetes, GraphQL, Next.js, Redis"
                          value={form.preferredSkills}
                          onChange={e => setForm({ ...form, preferredSkills: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </label>
                    </div>

                    {/* Salary details */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Salary Range (Min - Max)
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            placeholder="Min (e.g. 15000)"
                            value={form.salaryMin}
                            onChange={e => setForm({ ...form, salaryMin: e.target.value })}
                            className="w-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                          />
                          <span className="text-slate-400">-</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Max (e.g. 22000)"
                            value={form.salaryMax}
                            onChange={e => setForm({ ...form, salaryMax: e.target.value })}
                            className="w-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                      </label>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Currency & Period
                        <div className="mt-1 flex items-center gap-2">
                          <select
                            value={form.salaryCurrency}
                            onChange={e => setForm({ ...form, salaryCurrency: e.target.value })}
                            className="w-1/2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                          >
                            <option value="AED">AED</option>
                            <option value="USD">USD</option>
                            <option value="SAR">SAR</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                            <option value="INR">INR</option>
                          </select>
                          <select
                            value={form.salaryFrequency}
                            onChange={e => setForm({ ...form, salaryFrequency: e.target.value })}
                            className="w-1/2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                          >
                            <option value="MONTHLY">Monthly</option>
                            <option value="ANNUALLY">Annually</option>
                          </select>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.showSalaryPublicly}
                          onChange={e => setForm({ ...form, showSalaryPublicly: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        Display salary publicly on job boards
                      </label>
                    </div>

                    {/* Illustrative Salary Estimate Section */}
                    <div className="sm:col-span-3 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100/70 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                            <TrendingUp className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                                Illustrative Salary Estimate
                              </h4>
                              {benchmark?.seniorityLevel && (
                                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                                  {benchmark.seniorityLevel}
                                </span>
                              )}
                              {loadingBenchmark && (
                                <span className="text-[10px] font-medium text-slate-400 animate-pulse">
                                  Benchmarking…
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Regional compensation market percentiles for {form.title || 'this role'} in {form.location || 'Dubai, UAE'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {benchmark && (
                            <button
                              type="button"
                              onClick={applyBenchmark}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Apply Estimate ({form.salaryCurrency} {Number(benchmark.percentile25).toLocaleString()} - {Number(benchmark.percentile75).toLocaleString()})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => fetchSalaryBenchmark()}
                            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition"
                            title="Recalculate illustrative estimate"
                          >
                            Refresh
                          </button>
                        </div>
                      </div>

                      {benchmark ? (
                        <div className="mt-3 space-y-3">
                          {/* Competitiveness rating banner */}
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/90 p-2.5 border border-indigo-100/80">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-700">Position against estimate:</span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                                  benchmark.competitiveness === 'BELOW_MARKET'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : benchmark.competitiveness === 'PREMIUM'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                    : benchmark.competitiveness === 'HIGHLY_COMPETITIVE'
                                    ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                              >
                                {benchmark.competitivenessLabel}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              Target Range: <span className="font-bold text-slate-800">{benchmark.recommendedRange}</span>
                            </div>
                          </div>

                          {/* Percentile Cards Grid */}
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                25th Percentile (Min)
                              </div>
                              <div className="mt-1 text-sm font-bold text-slate-900">
                                {benchmark.currency} {Number(benchmark.percentile25).toLocaleString()}
                              </div>
                              <div className="text-[10px] text-slate-500">Entry / Lower quartile</div>
                            </div>

                            <div className="rounded-lg border-2 border-indigo-500/70 bg-indigo-50/50 p-2.5 shadow-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                                  50th (Illustrative midpoint)
                                </span>
                                <span className="rounded bg-indigo-200 px-1 text-[9px] font-bold text-indigo-900">Standard</span>
                              </div>
                              <div className="mt-1 text-sm font-extrabold text-indigo-950">
                                {benchmark.currency} {Number(benchmark.percentile50).toLocaleString()}
                              </div>
                              <div className="text-[10px] text-indigo-700/80">Regional midpoint</div>
                            </div>

                            <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                75th Percentile
                              </div>
                              <div className="mt-1 text-sm font-bold text-slate-900">
                                {benchmark.currency} {Number(benchmark.percentile75).toLocaleString()}
                              </div>
                              <div className="text-[10px] text-slate-500">Competitive / Top tier</div>
                            </div>

                            <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                90th Percentile
                              </div>
                              <div className="mt-1 text-sm font-bold text-slate-900">
                                {benchmark.currency} {Number(benchmark.percentile90).toLocaleString()}
                              </div>
                              <div className="text-[10px] text-slate-500">Premium / High talent</div>
                            </div>
                          </div>

                          {/* Insight and source */}
                          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400">
                            <span>📈 {benchmark.marketTrend}</span>
                            <span>{benchmark.dataSource}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-white/70 p-3 text-xs text-slate-500">
                          <span>Enter a title and experience to calculate a static planning estimate—not live market data.</span>
                          <button
                            type="button"
                            onClick={() => fetchSalaryBenchmark()}
                            className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                          >
                            Calculate Estimate
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-xs font-semibold text-slate-700">
                        Benefits, Perks & Work Culture
                        <textarea
                          rows={2}
                          placeholder="e.g. UAE Employment Visa, Family Medical Insurance, Annual Flight Ticket, 30 days vacation..."
                          value={form.benefitsSummary}
                          onChange={e => setForm({ ...form, benefitsSummary: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </label>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-xs font-semibold text-slate-700">
                        Application Instructions / Recruiter Contact
                        <input
                          type="text"
                          placeholder="e.g. Send CV to careers@grecha.ai with portfolio link"
                          value={form.applicationInstructions}
                          onChange={e => setForm({ ...form, applicationInstructions: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-[#061d3d] px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0b2954] disabled:opacity-50"
                >
                  {saving ? (
                    <>Saving…</>
                  ) : (
                    <>
                      <CheckCircle size={15} />
                      {form.id ? 'Save Changes' : 'Create Job Description & KPIs'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignModalTemplate&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={handleAssignSubmit} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6" aria-label="Assign job description"><h2 className="text-xl font-bold">Assign {assignModalTemplate.title}</h2><p className="text-sm text-slate-600">Creates a draft employee CAR for approval. It does not confirm probation or allocate leave.</p><label className="block">Employee<select aria-label="Assignment employee" required value={assignForm.employeeId} onChange={handleAssignEmployeeSelect} className="w-full rounded border p-2"><option value="">Select employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.fullName||`${e.firstName||''} ${e.lastName||''}`}</option>)}</select></label><label className="block">Evaluation type<select aria-label="Assignment type" value={assignForm.assignmentType} onChange={e=>handleAssignmentTypeToggle(e.target.value)} className="w-full rounded border p-2"><option value="PROBATION">Probation evaluation</option><option value="PMS_CYCLE">Performance cycle</option></select></label><p className="text-sm text-slate-600">{assignForm.assignmentType==='PROBATION'?'Dates use the applicable onboarding probation period. If no period applies, set explicit evaluation dates.':`Next review follows the company's ${reviewFrequency.toLowerCase()} frequency.`}</p><label className="block">Reporting manager<select aria-label="Assignment manager" value={assignForm.managerId} onChange={e=>setAssignForm({...assignForm,managerId:e.target.value})} className="w-full rounded border p-2"><option value="">Use employee reporting manager</option>{employees.filter(e=>String(e.id)!==String(assignForm.employeeId)).map(e=><option key={e.id} value={e.id}>{e.fullName||`${e.firstName||''} ${e.lastName||''}`}</option>)}</select></label>{[['effectiveFrom','Evaluation start'],['effectiveTo','Evaluation end'],['nextReviewDate','Next review']].map(([key,label])=><label key={key} className="block">{label}<input aria-label={label} required type="date" value={assignForm[key]} min={key==='effectiveFrom'?undefined:assignForm.effectiveFrom||undefined} onChange={e=>setAssignForm({...assignForm,[key]:e.target.value})} className="w-full rounded border p-2"/></label>)}<div className="flex justify-end gap-2"><button type="button" disabled={assigning} onClick={()=>setAssignModalTemplate(null)} className="btn">Cancel assignment</button><button disabled={assigning} className="btn primary">{assigning?'Assigning…':'Create employee CAR draft'}</button></div></form></div>}
      {/* Branded Job Description Preview & Export Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative my-8 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Preview Header */}
            <div className="flex items-start justify-between border-b border-slate-100 bg-[#061d3d] p-6 text-white rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-200 uppercase tracking-wider">
                    Official Job Specification
                  </span>
                  <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    {previewItem.status || 'ACTIVE'}
                  </span>
                </div>
                <h2 className="mt-2.5 font-serif text-2xl font-bold text-white">
                  {previewItem.title}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  {previewItem.departmentName && <span>🏢 {previewItem.departmentName}</span>}
                  {previewItem.reportsToTitle && <span>👤 Reports to: {previewItem.reportsToTitle}</span>}
                  {previewItem.location && <span>📍 {previewItem.location}</span>}
                  {previewItem.workMode && <span>💼 {formatWorkMode(previewItem.workMode)}</span>}
                  {previewItem.employmentType && <span>⏱️ {formatEmploymentType(previewItem.employmentType)}</span>}
                  {previewItem.vacancyCount && <span>👥 {previewItem.vacancyCount} {previewItem.vacancyCount === 1 ? 'Vacancy' : 'Vacancies'}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Preview Body */}
            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6 text-slate-800 text-sm">
              {/* Highlight Bar */}
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
                <div>
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Target Audience</div>
                  <div className="mt-1 font-semibold text-slate-800">
                    {previewItem.targetAudience === 'EXTERNAL'
                      ? 'Outside Hiring'
                      : previewItem.targetAudience === 'INTERNAL'
                      ? 'Inside Staff CAR'
                      : 'Dual (Internal/External)'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Experience Required</div>
                  <div className="mt-1 font-semibold text-slate-800">
                    {previewItem.experienceMinYears != null
                      ? `${previewItem.experienceMinYears}${previewItem.experienceMaxYears ? ` - ${previewItem.experienceMaxYears}` : '+'} Years`
                      : 'Not specified'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Open Vacancies</div>
                  <div className="mt-1 font-semibold text-amber-700">
                    {previewItem.vacancyCount ? `${previewItem.vacancyCount} Open Position${previewItem.vacancyCount > 1 ? 's' : ''}` : '1 Position'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Compensation</div>
                  <div className="mt-1 font-semibold text-emerald-700">
                    {previewItem.showSalaryPublicly && previewItem.salaryMin
                      ? `${previewItem.salaryCurrency} ${Number(previewItem.salaryMin).toLocaleString()}${previewItem.salaryMax ? ` - ${Number(previewItem.salaryMax).toLocaleString()}` : ''}`
                      : 'Competitive / Undisclosed'}
                    {previewItem.salaryBenchmarkMedian && (
                      <div className="text-[10px] text-indigo-700 font-normal">
                        Estimate midpoint: {previewItem.salaryCurrency} {Number(previewItem.salaryBenchmarkMedian).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Purpose */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">About the Role</h4>
                <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {previewItem.purpose || 'No purpose description provided.'}
                </p>
              </div>

              {/* Responsibilities */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Key Responsibilities & Deliverables</h4>
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {previewItem.scope || 'No responsibilities specified.'}
                </div>
              </div>

              {/* Performance KPIs Section */}
              {(() => {
                let kpiItems = []
                if (previewItem.draftContent) {
                  try {
                    const p = JSON.parse(previewItem.draftContent)
                    if (Array.isArray(p.kpis)) kpiItems = p.kpis
                  } catch (e) {}
                }
                if (!kpiItems.length) return null
                return (
                  <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 mb-3 flex items-center gap-1.5">
                      <Target size={15} className="text-purple-700" />
                      Role Performance KPIs & Success Scorecard
                    </h4>
                    <div className="space-y-2">
                      {kpiItems.map((kpi, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-purple-100 bg-white p-3 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{kpi.name}</div>
                            <div className="text-[11px] text-slate-500">{kpi.metricDefinition}</div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <span className="rounded bg-purple-100 px-2 py-0.5 font-bold text-purple-800">
                              {kpi.weight}% weight
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">Target: {kpi.targetValue}{kpi.unit}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Required & Preferred Skills */}
              {(previewItem.requiredSkills || previewItem.preferredSkills || previewItem.competencies) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {previewItem.requiredSkills && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Required Skills</h4>
                      <p className="text-xs leading-relaxed text-slate-600">{previewItem.requiredSkills}</p>
                    </div>
                  )}

                  {previewItem.preferredSkills && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Preferred Qualifications</h4>
                      <p className="text-xs leading-relaxed text-slate-600">{previewItem.preferredSkills}</p>
                    </div>
                  )}

                  {previewItem.competencies && (
                    <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Core Competencies & Traits</h4>
                      <p className="text-xs leading-relaxed text-slate-600">{previewItem.competencies}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Benefits */}
              {previewItem.benefitsSummary && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Benefits & Offer</h4>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 text-xs leading-relaxed text-emerald-900 whitespace-pre-wrap">
                    {previewItem.benefitsSummary}
                  </div>
                </div>
              )}

              {/* How to Apply */}
              {previewItem.applicationInstructions && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-1">How to Apply</h4>
                  <p className="text-xs text-blue-800">{previewItem.applicationInstructions}</p>
                </div>
              )}
            </div>

            {/* Preview Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 rounded-b-2xl">
              <span className="text-xs text-slate-500">
                Ready for external recruitment or internal employee CAR conversion
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                >
                  <Printer size={14} />
                  Print
                </button>

                <button
                  type="button"
                  onClick={() => copyForJobBoard(previewItem)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#061d3d] px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0b2954]"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? 'Copied to Clipboard!' : 'Copy for Job Board'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
