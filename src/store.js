import { readFile, writeFile, rename } from 'node:fs/promises'

const FILE = new URL('../data.json', import.meta.url)
const TMP = new URL('../data.json.tmp', import.meta.url)

// Single source of truth, persisted so restarting the bot does not re-send an
// alert for a creator that was already live before the restart.
export const state = { creators: [], channels: {}, status: {}, events: [] }

export const load = async () => {
  try {
    Object.assign(state, JSON.parse(await readFile(FILE, 'utf8')))
  } catch {}
}

export const save = async () => {
  await writeFile(TMP, JSON.stringify(state, null, 2))
  await rename(TMP, FILE)
}

// Newest first and capped, otherwise the dashboard feed grows forever.
export const addEvent = (type, creator, extra = {}) => {
  state.events.unshift({ type, creator, at: Date.now(), ...extra })
  state.events.length = Math.min(state.events.length, 50)
}
