export type MusicState = {
  state: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'UNAVAILABLE'
  playbackState: 'IDLE' | 'CLIENT_CLOSED' | 'PLAYING' | 'PAUSED'
  error: string
  trackId: string
  title: string
  artist: string
  playing: boolean
  positionMs: number
  durationMs: number
  lyrics: { timeMs: number; text: string }[]
  lyricsState: 'NONE' | 'LOADING' | 'AVAILABLE' | 'UNAVAILABLE'
  updatedAt: number
}

export const disconnectedMusic: MusicState = {
  state: 'DISCONNECTED', playbackState: 'IDLE', error: '', trackId: '', title: '', artist: '', playing: false,
  positionMs: 0, durationMs: 0, lyrics: [], lyricsState: 'NONE', updatedAt: 0,
}

export function musicStatusLabel(music: MusicState) {
  if (music.state === 'DISCONNECTED') return '连接已关闭'
  if (music.state === 'CONNECTING') return '正在连接'
  if (music.state !== 'CONNECTED') return '音乐未连接'
  return { IDLE: '等待播放', CLIENT_CLOSED: '网易云未启动', PLAYING: '播放中', PAUSED: '已暂停' }[music.playbackState]
}

export function currentLyricIndex(music: MusicState) {
  let index = -1
  for (let position = 0; position < music.lyrics.length; position += 1) {
    if (music.lyrics[position].timeMs > music.positionMs) break
    index = position
  }
  return index
}
