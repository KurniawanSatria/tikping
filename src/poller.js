import { state } from './store.js'
import { checkLive } from './live.js'

export const __changed = (prev, next) =>
  !next ? null : (!prev?.live && next.live ? 'live' : prev?.live && !next.live ? 'offline' : null)

// One poll round. A failed check keeps the previous `live` flag, so a TikTok
// hiccup can never look like the creator went offline. Returns nothing; the
// caller gets state.status updated in place.
export const runOnce = async onChange => {
  // shortcut: every creator is checked in parallel, fine up to a few dozen.
  // Past that TikTok starts throttling the IP, so batch it then.
  const results = await Promise.allSettled(state.creators.map(c => checkLive(c.username)))

  for (const [i, result] of results.entries()) {
    const { username } = state.creators[i]
    const prev = state.status[username]
    if (result.status === 'rejected') {
      state.status[username] = { ...prev, error: result.reason?.message || String(result.reason), checkedAt: Date.now() }
      continue
    }
    const next = result.value
    const event = __changed(prev, next)
    state.status[username] = { ...next, checkedAt: Date.now() }
    if (event) await onChange({ event, username, room: next })
  }
}
