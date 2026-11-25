import { strainTypeInfo } from '../lib/constants'
import type { StrainType } from '../lib/types'

export function StrainTypePill({ type }: { type: StrainType }) {
  if (type === 'unknown') return null
  const t = strainTypeInfo(type)
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${t.className}`}>{t.label}</span>
}
