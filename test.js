import assert from 'node:assert/strict'
import { parseRoom } from './src/live.js'
import { __changed } from './src/poller.js'
import { state, addEvent } from './src/store.js'
import { livePayload } from './src/bot.js'

const user = { id: '1', nickname: 'Tester', roomId: '99', avatarThumb: 'https://x/a.webp' }
const room = status => ({ statusCode: 0, data: { user, liveRoom: { status, title: 'hello', startTime: 1, liveRoomStats: { userCount: 42 } } } })

assert.equal(parseRoom(room(4)).live, false, 'status 4 must be offline')
assert.equal(parseRoom(room(2)).live, true, 'status 2 must be live')
assert.equal(parseRoom(room(2)).viewers, 42)
assert.equal(parseRoom(room(2)).nickname, 'Tester')
assert.equal(parseRoom(room(0)).live, false, 'unknown status must not count as live')
assert.throws(() => parseRoom({ statusCode: 0, data: {} }), /not found/)

assert.equal(__changed(undefined, { live: true }), 'live', 'first ever check while live must alert')
assert.equal(__changed({ live: false }, { live: true }), 'live')
assert.equal(__changed({ live: true }, { live: true }), null, 'still live must not re-alert')
assert.equal(__changed({ live: true }, { live: false }), 'offline')
assert.equal(__changed({ live: false }, { live: false }), null)
assert.equal(__changed({ live: true }, undefined), null, 'missing next must not alert')

for (let i = 0; i < 60; i++) addEvent('live', `user${i}`)
assert.equal(state.events.length, 50, 'event feed must be capped')
assert.equal(state.events[0].creator, 'user59', 'newest event first')
assert.ok(state.events[0].at > 0)

// Shape of the live alert: discord rejects a field whose name or value is empty,
// so the placeholder fields from the sketch must always carry real text.
const payload = livePayload({
  username: 'requinn99',
  room: { nickname: 'Requinn', avatar: 'https://x/a.webp', title: 'jojo pasti', viewers: 11, startTime: 1793412445 },
})
const embed = payload.embeds[0].toJSON()
const row = payload.components[0].toJSON()

assert.equal(embed.title, 'jojo pasti')
assert.equal(embed.color, 1381400)
assert.equal(embed.author.name, 'Requinn')
assert.equal(embed.author.icon_url, 'https://x/a.webp')
assert.ok(embed.fields.every(f => f.name.length > 0 && f.value.length > 0), 'empty fields are rejected by discord')
assert.equal(embed.fields.find(f => f.name === 'Viewers').value, '11')
assert.equal(row.type, 1, 'action row')
assert.equal(row.components[0].type, 2, 'button')
assert.equal(row.components[0].style, 5, 'link button')
assert.equal(row.components[0].url, 'https://www.tiktok.com/@requinn99/live')

const bare = livePayload({ username: 'x', room: { viewers: 0 } }).embeds[0].toJSON()
assert.equal(bare.title, 'TikTok LIVE')
assert.equal(bare.author.icon_url, undefined, 'no avatar must not produce a broken icon_url')
assert.equal(payload.content.startsWith(process.env.PING || '@here'), true, 'the ping line is what mentions everyone')

// Alert channel is per server, so a second server cannot steal the first one's.
assert.deepEqual(state.channels, {}, 'starts with no alert channel')
state.channels['111'] = 'aaa'
state.channels['222'] = 'bbb'
assert.equal(Object.keys(state.channels).length, 2, 'one server must not overwrite another')

// The same built payload is fanned out to every channel, so serializing it twice
// must give the same JSON both times.
assert.deepEqual(payload.embeds[0].toJSON(), payload.embeds[0].toJSON(), 'embed serializes the same twice')
assert.deepEqual(payload.components[0].toJSON(), payload.components[0].toJSON(), 'button row serializes the same twice')

console.log('PASS · 32 assertions')
