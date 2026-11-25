import { registerSW } from 'virtual:pwa-register'

// Keep the home-screen app up to date: look for a new version on start and whenever
// the app comes back to the foreground, and reload as soon as one is installed.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => { if (navigator.onLine) registration.update().catch(() => {}) }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    setInterval(check, 30 * 60_000)
  },
})
