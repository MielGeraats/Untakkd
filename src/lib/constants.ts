import type { Method, StrainType } from './types'

export const METHODS: { id: Method; label: string; emoji: string }[] = [
  { id: 'joint', label: 'Joint', emoji: '🚬' },
  { id: 'blunt', label: 'Blunt', emoji: '🌯' },
  { id: 'spliff', label: 'Spliff', emoji: '🍃' },
  { id: 'bong', label: 'Bong', emoji: '🫧' },
  { id: 'pipe', label: 'Pijp', emoji: '🪈' },
  { id: 'vape', label: 'Vape', emoji: '💨' },
  { id: 'edible', label: 'Spacecake', emoji: '🍪' },
  { id: 'other', label: 'Anders', emoji: '✨' },
]
export const methodInfo = (m: Method) => METHODS.find((x) => x.id === m) ?? METHODS[METHODS.length - 1]

export const STRAIN_TYPES: { id: StrainType; label: string; className: string }[] = [
  { id: 'indica', label: 'Indica', className: 'bg-violet-100 text-violet-800' },
  { id: 'sativa', label: 'Sativa', className: 'bg-amber-100 text-amber-800' },
  { id: 'hybrid', label: 'Hybrid', className: 'bg-leaf-100 text-leaf-800' },
  { id: 'unknown', label: 'Geen idee', className: 'bg-stone-100 text-stone-600' },
]
export const strainTypeInfo = (t: StrainType) => STRAIN_TYPES.find((x) => x.id === t) ?? STRAIN_TYPES[3]
