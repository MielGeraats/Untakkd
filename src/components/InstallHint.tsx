import { useState } from 'react'
import { XIcon } from './Icons'

const KEY = 'untakkd:install-hint-closed'

// True when opened from the home screen (then the tip is pointless).
const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export function InstallHint() {
  const [closed, setClosed] = useState(() => isInstalled() || localStorage.getItem(KEY) === '1')
  if (closed) return null
  const iphone = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <div className="card relative mb-4 border-leaf-300 bg-gradient-to-br from-leaf-100 to-white p-4 pr-10">
      <button aria-label="Sluiten" onClick={() => { localStorage.setItem(KEY, '1'); setClosed(true) }}
        className="absolute right-3 top-3 rounded-full p-1 text-leaf-800/40 hover:bg-white hover:text-leaf-800/70">
        <XIcon className="size-4" />
      </button>
      <p className="font-black">📲 Tip: als je deze link op je beginscherm zet krijg je het als een app-weergave!</p>
      <p className="mt-1 text-sm text-leaf-800/70">
        {iphone
          ? <>Open in Safari → tik op Deel <span aria-hidden>⬆️</span> → <b>Zet op beginscherm</b>.</>
          : <>Open in Chrome → menu ⋮ → <b>App installeren</b> of <b>Toevoegen aan startscherm</b>.</>}
      </p>
    </div>
  )
}
