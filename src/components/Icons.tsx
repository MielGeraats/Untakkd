import type { SVGProps } from 'react'

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' } as const
type P = SVGProps<SVGSVGElement>

export const HomeIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
)
export const UsersIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17.5 14c2.4.2 4 2 4 4.5" /></svg>
)
export const UserIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>
)
export const PlusIcon = (p: P) => (
  <svg {...base} strokeWidth={2.6} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const ChatIcon = (p: P) => (
  <svg {...base} {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" /></svg>
)
export const FlameIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} fill={filled ? 'currentColor' : 'none'} {...p}>
    <path d="M12 21c-3.9 0-7-2.8-7-6.6 0-2.8 1.6-4.6 3-6 .3 1.7 1.2 2.9 2.4 3.4-.2-3.5 1.4-6.6 4.1-8.8.4 2.6 1.9 4.4 3.3 6 1.3 1.5 2.2 3.1 2.2 5.4 0 3.8-3.1 6.6-7 6.6z" />
  </svg>
)
export const SearchIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const XIcon = (p: P) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const CameraIcon = (p: P) => (
  <svg {...base} {...p}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></svg>
)
export const ChevronLeft = (p: P) => (
  <svg {...base} {...p}><path d="m15 18-6-6 6-6" /></svg>
)

// Cannabis leaf — same geometry as the app icon.
const LEAFLETS: [number, number, number][] = [[0, 230, 34], [-32, 190, 30], [32, 190, 30], [-64, 145, 24], [64, 145, 24], [-100, 85, 16], [100, 85, 16]]
export const LeafIcon = (p: P) => (
  <svg viewBox="-170 -240 340 340" fill="currentColor" {...p}>
    {LEAFLETS.map(([a, L, w]) => (
      <path key={a} transform={`rotate(${a})`}
        d={`M0 0 C${w} ${-L * 0.3} ${w * 1.1} ${-L * 0.7} 0 ${-L} C${-w * 1.1} ${-L * 0.7} ${-w} ${-L * 0.3} 0 0Z`} />
    ))}
    <path d="M-6 0 L6 0 L4 90 L-4 90Z" />
  </svg>
)
