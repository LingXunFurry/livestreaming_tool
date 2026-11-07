import { currentLyricIndex, musicStatusLabel, type MusicState } from './music'

const formatTime = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

export function MusicPanel({ music }: { music: MusicState }) {
  const index = currentLyricIndex(music)
  const connected = music.state === 'CONNECTED' && Boolean(music.title)
  const lyricMessage = { NONE: '暂无歌词', LOADING: '正在读取歌词', UNAVAILABLE: '歌词暂不可用', AVAILABLE: '前奏' }[music.lyricsState]
  const currentLine = connected ? music.lyrics[index]?.text || (index >= 0 ? '♪' : lyricMessage) : musicStatusLabel(music)
  const nextLine = connected ? music.lyrics[index + 1]?.text : ''

  return <section className="lyrics-board" aria-label="网易云播放信息" data-music-state={music.playbackState} data-music-connection={music.state} data-lyrics-source="real" data-lyric-index={index}>
    <div className="lyrics-heading"><span className="module-index">03 / 正在播放</span><span className="music-state">{musicStatusLabel(music)}</span></div>
    <div className="song-title" title={`${music.title} ${music.artist}`}>{music.title || '等待音乐响起'}<span>{music.artist}</span></div>
    <div className="song-progress" role="progressbar" aria-label="歌曲播放进度" aria-valuemin={0} aria-valuemax={music.durationMs || 1} aria-valuenow={music.positionMs}>
      <i style={{ width: `${music.durationMs ? music.positionMs / music.durationMs * 100 : 0}%` }} />
    </div>
    <div className="song-time"><span>{formatTime(music.positionMs)}</span><span>{music.durationMs ? formatTime(music.durationMs) : '--:--'}</span></div>
    <p className="lyric-line current" title={currentLine}>{currentLine}</p>
    <p className="lyric-line" title={nextLine}>{nextLine || '\u00a0'}</p>
  </section>
}
