import { load, state, addEvent, save } from './store.js'
import { runOnce } from './poller.js'
import { startBot, announceLive, announceOffline } from './bot.js'
import { startServer } from './server.js'

const pollSeconds = Number(process.env.POLL_SECONDS || 60)

const onLiveChange = async ({ event, username, room }) => {
  addEvent(event, username, { title: room.title, viewers: room.viewers })
  await save()
  if (event === 'live') await announceLive({ username, room })
  else await announceOffline({ username, room })
}

const tick = () => runOnce(onLiveChange).catch(e => console.error('poll failed:', e.message))

const main = async () => {
  if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is missing, copy .env.example to .env')
  await load()
  await startBot()
  startServer(pollSeconds)
  await tick()
  setInterval(tick, pollSeconds * 1000)
  console.log(`tracking ${state.creators.length} creator(s), polling every ${pollSeconds}s`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
