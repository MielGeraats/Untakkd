import { useEffect, useState } from 'react'

/**
 * "De Ringbaap" flips over to "De Baapring" (the joke in the name). Tap it to flip again.
 */
export function BaapringLogo({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 600)
    return () => clearTimeout(t)
  }, [])

  const text = size === 'lg' ? 'text-4xl' : 'text-2xl'
  const face = `absolute inset-0 flex items-center justify-center gap-2 [backface-visibility:hidden] font-black tracking-tight ${text}`

  return (
    <button type="button" onClick={() => setFlipped((f) => !f)} aria-label="De Baapring"
      className={`relative mx-auto block w-full [perspective:800px] ${size === 'lg' ? 'h-14' : 'h-9'}`}>
      <span className={`absolute inset-0 transition-transform duration-700 [transform-style:preserve-3d] ${flipped ? '[transform:rotateX(180deg)]' : ''}`}>
        <span className={`${face} text-leaf-800/60`}>
          De <span>Ring</span><span>baap</span> <span aria-hidden>💍🇫</span>
        </span>
        <span className={`${face} [transform:rotateX(180deg)]`}>
          De <span className="text-leaf-600">Baap</span><span className="-ml-2 rounded-full border-4 border-amber-400 px-1.5 leading-none text-amber-500">ring</span>
          <span aria-hidden className={`inline-block ${flipped ? 'animate-[spin_1.2s_ease-out_1]' : ''}`}>💍</span>
        </span>
      </span>
    </button>
  )
}
