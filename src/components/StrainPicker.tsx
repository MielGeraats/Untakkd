import { useEffect, useState } from 'react'
import { STRAIN_TYPES } from '../lib/constants'
import { supabase } from '../lib/supabase'
import type { Strain, StrainType } from '../lib/types'
import { SearchIcon } from './Icons'
import { StrainTypePill } from './StrainTypePill'

export function StrainPicker({ value, onChange }: { value: Strain | null; onChange: (s: Strain | null) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Strain[]>([])
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState<StrainType>('hybrid')
  const [error, setError] = useState('')

  useEffect(() => {
    const term = q.trim()
    if (!term) return setResults([])
    const t = setTimeout(async () => {
      const { data } = await supabase.from('strains').select('*')
        .ilike('name', `%${term.replace(/[%_\\]/g, (m) => '\\' + m)}%`).order('name').limit(8)
      setResults(data ?? [])
    }, 180)
    return () => clearTimeout(t)
  }, [q])

  const exact = results.find((s) => s.name.toLowerCase() === q.trim().toLowerCase())

  async function create() {
    setError('')
    const name = q.trim()
    const { data, error } = await supabase.from('strains').insert({ name, type: newType }).select().single()
    if (data) return pick(data)
    if (error?.code === '23505') {
      const { data: existing } = await supabase.from('strains').select('*').ilike('name', name).limit(1).maybeSingle()
      if (existing) return pick(existing)
    }
    setError(error?.message ?? 'Strain toevoegen mislukt')
  }

  function pick(s: Strain) {
    onChange(s)
    setQ('')
    setCreating(false)
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-leaf-300 bg-leaf-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black">{value.name}</span>
          <StrainTypePill type={value.type} />
        </div>
        <button type="button" className="text-sm font-bold text-leaf-700 underline" onClick={() => onChange(null)}>Wijzig</button>
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-leaf-500" />
        <input className="input pl-11" placeholder="Zoek een strain… bijv. Amnesia Haze" value={q}
          onChange={(e) => { setQ(e.target.value); setCreating(false) }} />
      </div>
      {q.trim() && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-leaf-100 bg-white">
          {results.map((s) => (
            <button key={s.id} type="button" onClick={() => pick(s)}
              className="flex w-full items-center gap-2 border-b border-leaf-50 px-4 py-2.5 text-left font-bold hover:bg-leaf-50">
              {s.name} <StrainTypePill type={s.type} />
            </button>
          ))}
          {!exact && !creating && (
            <button type="button" onClick={() => setCreating(true)}
              className="w-full px-4 py-2.5 text-left font-bold text-leaf-700 hover:bg-leaf-50">
              ＋ “{q.trim()}” toevoegen als nieuwe strain
            </button>
          )}
          {creating && (
            <div className="space-y-3 p-4">
              <p className="text-sm font-bold">Wat voor soort is “{q.trim()}”?</p>
              <div className="flex flex-wrap gap-2">
                {STRAIN_TYPES.map((t) => (
                  <button key={t.id} type="button" onClick={() => setNewType(t.id)}
                    className={`chip ${newType === t.id ? 'chip-on' : 'chip-off'}`}>{t.label}</button>
                ))}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="button" className="btn btn-primary btn-sm" onClick={create}>Strain toevoegen</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
