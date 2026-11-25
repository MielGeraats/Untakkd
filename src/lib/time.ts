export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'net'
  const m = s / 60
  if (m < 60) return `${Math.floor(m)} min geleden`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)} uur geleden`
  const d = h / 24
  if (d < 7) return `${Math.floor(d)}d geleden`
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined })
}
