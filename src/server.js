import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { state } from './store.js'

const PAGE = new URL('../public/index.html', import.meta.url)
const startedAt = Date.now()

const send = (res, code, type, body) => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(body)
}

export const startServer = pollSeconds => {
  const host = process.env.HOST || '127.0.0.1'
  const port = Number(process.env.PORT || 3000)

  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url, `http://${host}`)

    if (pathname === '/api/status') {
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
        startedAt,
        pollSeconds,
        channels: state.channels,
        creators: state.creators,
        status: state.status,
        events: state.events,
      }))
    }

    if (pathname === '/' || pathname === '/index.html') {
      return send(res, 200, 'text/html; charset=utf-8', await readFile(PAGE))
    }

    send(res, 404, 'text/plain; charset=utf-8', 'not found')
  })

  server.listen(port, host, () => console.log(`dashboard  http://${host}:${port}`))
  return server
}
