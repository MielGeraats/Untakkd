import type { Badge } from '../lib/stats'

const CONFETTI = ['🎉', '✨', '🌿', '🔥', '⭐', '💨', '🎊', '🍃']

/** Full-screen "you earned a badge" moment, shown right after a check-in. */
export function BadgeCelebration({ badges, onClose }: { badges: Badge[]; onClose: () => void }) {
  const levelUp = badges.every((b) => b.level > 1)
  return (
    <div role="dialog" aria-modal="true" aria-label="Badge verdiend"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-leaf-950/70 p-4 backdrop-blur-sm">
      {/* confetti */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="confetti absolute text-2xl"
            style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.25}s`, animationDuration: `${2.4 + (i % 5) * 0.4}s` }}>
            {CONFETTI[i % CONFETTI.length]}
          </span>
        ))}
      </div>

      <div className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-[2rem] bg-gradient-to-br from-amber-50 via-white to-leaf-50 p-6 text-center shadow-2xl">
        <p className="text-sm font-black uppercase tracking-widest text-amber-600">{levelUp ? 'Level up!' : badges.length > 1 ? 'Nieuwe badges!' : 'Nieuwe badge!'}</p>
        <h2 className="mt-1 text-3xl font-black">{levelUp ? '🚀 Lekker bezig' : '🎉 Proost!'}</h2>

        <div className="mt-5 space-y-3">
          {badges.map((b, i) => (
            <div key={b.id} className="pop-in flex items-center gap-4 rounded-3xl border-2 border-amber-300 bg-white p-4 text-left shadow-sm"
              style={{ animationDelay: `${0.15 + i * 0.2}s` }}>
              <span className="text-5xl drop-shadow">{b.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-black leading-tight">{b.name}</span>
                {b.maxLevel > 1 && <span className="mt-0.5 inline-block rounded-full bg-leaf-600 px-2 py-0.5 text-[11px] font-black text-white">LVL {b.level}{!b.next && ' · MAX 👑'}</span>}
                <span className="mt-1 block text-xs text-leaf-800/60">{b.next ? `Volgende level bij ${b.next}` : b.desc}</span>
              </span>
            </div>
          ))}
        </div>

        <button type="button" onClick={onClose} className="btn btn-primary mt-6 w-full py-4 text-lg">Lekker! Verder 🔥</button>
        <p className="mt-2 text-xs text-leaf-800/45">Staat ook in je meldingen 🔔</p>
      </div>
    </div>
  )
}
