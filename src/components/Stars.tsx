import { useState } from 'react'

const STAR = 'M12 2.4l2.95 6.07 6.65.86-4.88 4.6 1.24 6.6L12 17.3l-5.96 3.23 1.24-6.6-4.88-4.6 6.65-.86z'

function Star({ fill, size }: { fill: number; size: number }) {
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} className="absolute inset-0 text-leaf-200" fill="currentColor"><path d={STAR} /></svg>
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
        <svg viewBox="0 0 24 24" width={size} height={size} className="text-leaf-500" fill="currentColor"><path d={STAR} /></svg>
      </span>
    </span>
  )
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} van de 5 sterren`}>
      {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={size} fill={Math.max(0, Math.min(1, value - i))} />)}
    </span>
  )
}

/** Tap the left half of a star for a half rating, the right half for a full one. */
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value
  return (
    <div className="flex items-center gap-4">
      <div className="flex gap-1" onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="relative">
            <Star size={40} fill={Math.max(0, Math.min(1, shown - i))} />
            {[0.5, 1].map((part) => (
              <button key={part} type="button" aria-label={`${i + part} sterren`}
                className={`absolute inset-y-0 w-1/2 ${part === 0.5 ? 'left-0' : 'right-0'}`}
                onMouseEnter={() => setHover(i + part)} onClick={() => onChange(i + part)} />
            ))}
          </span>
        ))}
      </div>
      <span className="w-10 text-2xl font-black text-leaf-700">{shown ? shown.toFixed(1) : '–'}</span>
    </div>
  )
}
