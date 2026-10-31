const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// TikTok's own web API, no auth and no cookies needed. In `liveRoom`, status 2
// means live and 4 means offline/ended; a roomId alone does NOT mean live.
export const parseRoom = json => {
  const data = json?.data
  if (!data?.user?.id) throw new Error(json?.message || 'creator not found')
  const room = data.liveRoom ?? {}
  return {
    live: room.status === 2,
    title: room.title || '',
    viewers: room.liveRoomStats?.userCount ?? 0,
    startTime: room.startTime || 0,
    roomId: data.user.roomId || '',
    nickname: data.user.nickname || '',
    avatar: data.user.avatarThumb || '',
  }
}

export const checkLive = async uniqueId => {
  const query = `aid=1988&sourceType=54&uniqueId=${encodeURIComponent(uniqueId)}`
  const res = await fetch(`https://www.tiktok.com/api-live/user/room/?${query}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`tiktok http ${res.status}`)
  return parseRoom(await res.json())
}
