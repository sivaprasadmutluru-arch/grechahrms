import { ChevronDown } from 'lucide-react'
import { splitTimeValue, updateTimeValue } from '../../utils/timeSelector'

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

export default function TimeSelector({ id, label, value, onChange, disabled = false, hideLabel = false }) {
  const parts = splitTimeValue(value)
  const select = (field, options, placeholder) => (
    <div className={`relative min-w-0 ${field === 'period' ? 'flex-[1.25]' : 'flex-1'}`}>
      <select id={field === 'hour' ? id : `${id}-${field}`} value={parts[field]} disabled={disabled}
        aria-label={`${label} ${field === 'period' ? 'AM or PM' : field}`}
        onChange={event => onChange(updateTimeValue(value, field, event.target.value))}
        className={`w-full cursor-pointer appearance-none rounded-md py-2 pl-1.5 pr-4 text-center text-sm font-medium tabular-nums outline-none transition focus:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 disabled:cursor-default disabled:text-gray-500 ${field === 'period' ? 'bg-indigo-50 text-indigo-700 disabled:bg-gray-100' : 'bg-transparent text-gray-900'}`}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      {!disabled && <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" aria-hidden="true" />}
    </div>
  )
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={`mb-1 block text-xs font-medium text-gray-500 ${hideLabel ? 'lg:sr-only' : ''}`}>{label}</label>
      <div role="group" aria-label={label}
        className={`flex w-full min-w-0 items-center gap-0.5 rounded-lg border p-1 transition ${disabled ? 'border-transparent bg-gray-50' : 'border-gray-300 bg-white shadow-sm focus-within:border-indigo-400'}`}>
        {disabled && !value ? <span id={id} className="px-2 py-2 text-sm text-gray-400">—</span> : <>
        {select('hour', HOURS, 'HH')}
        <span className="text-sm font-semibold text-gray-400" aria-hidden="true">:</span>
        {select('minute', MINUTES, 'MM')}
        {select('period', ['AM', 'PM'])}
        </>}
      </div>
    </div>
  )
}
