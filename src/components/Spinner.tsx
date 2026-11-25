import type { ReactNode } from 'react'
import { LeafIcon } from './Icons'

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-leaf-500">
      <LeafIcon className="size-10 animate-[spin_2.4s_linear_infinite]" />
      {label && <p className="text-sm font-bold text-leaf-700/70">{label}</p>}
    </div>
  )
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-2 text-4xl">{emoji}</div>
      <p className="text-lg font-black">{title}</p>
      {children && <div className="mt-1 text-sm text-leaf-800/70">{children}</div>}
    </div>
  )
}
