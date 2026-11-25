import { useState } from 'react'

export type PlaceOption = { label: string; mine: boolean }

/** Text input with a tap-to-pick list of places you (or your friends) used before. */
export function PlaceInput({ id, value, onChange, options, placeholder }: {
  id: string
  value: string
  onChange: (v: string) => void
  options: PlaceOption[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const term = value.trim().toLowerCase()
  const matches = options
    .filter((o) => !term || (o.label.toLowerCase().includes(term) && o.label.toLowerCase() !== term))
    .slice(0, 8)

  return (
    <div className="relative">
      <input id={id} className="input pr-10" maxLength={80} autoComplete="off" placeholder={placeholder} value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {value && (
        <button type="button" aria-label="Wissen" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 px-1 text-lg font-bold text-leaf-800/35 hover:text-leaf-800/70">×</button>
      )}
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-leaf-100 bg-white shadow-lg">
          {matches.map((o, i) => (
            <div key={o.label}>
              {!o.mine && (i === 0 || matches[i - 1].mine) && (
                <p className="bg-leaf-50 px-4 pt-2 pb-1 text-[11px] font-extrabold uppercase tracking-wide text-leaf-800/45">Van je maten</p>
              )}
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(o.label); setOpen(false) }}
                className="w-full px-4 py-2.5 text-left font-bold hover:bg-leaf-50">
                {o.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
