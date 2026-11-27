import type { ReactNode } from 'react'

/** Shown under every real error (not under "pick a strain first"-type hints). */
export function BugNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs font-bold text-red-700/80 ${className}`}>
      🐛 Aiino, je hebt een bug gevonden in deze kut app. Stuur Miel even een berichtje, dan is het zo gefixt!
    </p>
  )
}

/** Red error box. `bug={false}` for messages that are the user's to fix (typo, missing field). */
export function ErrorBox({ children, bug = true, className = '' }: { children: ReactNode; bug?: boolean; className?: string }) {
  return (
    <div className={`rounded-2xl bg-red-50 p-3 text-sm text-red-700 ${className}`}>
      <p className="font-bold">{children}</p>
      {bug && <BugNote className="mt-1.5" />}
    </div>
  )
}
