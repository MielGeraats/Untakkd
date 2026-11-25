export type PlaceKind = 'spot' | 'shop'

export const PLACE_KINDS: Record<PlaceKind, { column: 'smoked_at' | 'bought_at'; path: string; emoji: string; label: string }> = {
  spot: { column: 'smoked_at', path: 'plek', emoji: '📍', label: 'Blowplek' },
  shop: { column: 'bought_at', path: 'shop', emoji: '🛒', label: 'Shop' },
}

// Dots are encoded too: Vercel treats paths with a dot as files, so "St. Pieter" would 404 on reload.
export const placeUrl = (kind: PlaceKind, name: string) =>
  `/${PLACE_KINDS[kind].path}/${encodeURIComponent(name.trim()).replace(/\./g, '%2E')}`
