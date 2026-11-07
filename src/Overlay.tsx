import { useEffect, useRef, useState, type CSSProperties } from 'react'
import defaultSettings from '../config/example.json'
import { appendSimulatedMessage, eventTimeline, initialMessages, lyricIndexAt, lyricLines, messageLabels } from './simulation'
import type { SimulatedMessage } from './simulation'

const announcementColors = new Set(['gold', 'red', 'wind', 'cream'])

function renderAnnouncementInline(value: string, keyPrefix = 'text'): React.ReactNode[] {
  const colorMatch = value.match(/<span\s+style=["']color\s*:\s*(gold|red|wind|cream)\s*["']>([\s\S]*?)<\/span>/i)
  if (colorMatch && announcementColors.has(colorMatch[1].toLowerCase())) {
    const start = colorMatch.index ?? 0
    return [
      ...renderAnnouncementInline(value.slice(0, start), `${keyPrefix}-before`),
      <span className={`notice-text--${colorMatch[1].toLowerCase()}`} key={`${keyPrefix}-color`}>
        {renderAnnouncementInline(colorMatch[2], `${keyPrefix}-color-text`)}
      </span>,
      ...renderAnnouncementInline(value.slice(start + colorMatch[0].length), `${keyPrefix}-after`),
    ]
  }

  const boldMatch = value.match(/(\*\*|__)(.+?)\1/)
  if (boldMatch) {
    const start = boldMatch.index ?? 0
    return [
      ...renderAnnouncementInline(value.slice(0, start), `${keyPrefix}-before`),
      <strong key={`${keyPrefix}-bold`}>{renderAnnouncementInline(boldMatch[2], `${keyPrefix}-bold-text`)}</strong>,
      ...renderAnnouncementInline(value.slice(start + boldMatch[0].length), `${keyPrefix}-after`),
    ]
  }

  return value ? [value] : []
}

function renderAnnouncement(value: string) {
  return value.split('\n').flatMap((line, index) => [
    ...(index ? [<br key={`line-${index}`} />] : []),
    ...renderAnnouncementInline(line, `line-${index}`),
  ])
}

export type Platform = 'bilibili' | 'douyin'
export type BoardMode = 'comments' | 'announcement'
export type GlobalFontSizes = typeof defaultSettings.global.fontSizes
export type PlatformFontSizes = typeof defaultSettings.platforms.bilibili.fontSizes

export const platformNames: Record<Platform, string> = {
  bilibili: 'B 站',
  douyin: '抖音',
}

export const benefitsTitles: Record<Platform, string> = {
  bilibili: '上舰福利',
  douyin: '灯牌福利',
}

function MessageBoard({ platform }: { platform: Platform }) {
  const [messages, setMessages] = useState(() => initialMessages[platform])
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(initialMessages[platform])
    let eventIndex = 0
    const timer = window.setInterval(() => {
      const event = eventTimeline[platform][eventIndex % eventTimeline[platform].length]
      const message: SimulatedMessage = { ...event, id: `${platform}-${eventIndex}` }
      eventIndex += 1
      setMessages(current => appendSimulatedMessage(current, message))
    }, 3000)
    return () => window.clearInterval(timer)
  }, [platform])

  useEffect(() => {
    const messagesElement = messagesRef.current
    if (!messagesElement) return
    let active = true
    const scrollToBottom = () => {
      if (active) messagesElement.scrollTop = messagesElement.scrollHeight
    }
    scrollToBottom()
    const frame = window.requestAnimationFrame(scrollToBottom)
    document.fonts.ready.then(scrollToBottom)
    return () => {
      active = false
      window.cancelAnimationFrame(frame)
    }
  }, [messages])

  return (
    <section className="side-board" aria-label={`${platformNames[platform]}留言板`}>
      <div className="module-heading">
        <div><h2>酒馆留言板</h2></div>
      </div>
      <div className="messages" ref={messagesRef}>
        {messages.map(message => (
          <div className={`message message--${message.kind}`} data-event-kind={message.kind} data-gift-count={message.count} key={message.id}>
            <div className="message-meta"><span>{messageLabels[message.kind]}</span><b>{message.name}</b>{message.detail && <small className="message-detail">{message.detail}</small>}{message.kind === 'gift' && <small className="message-detail">×{message.count}</small>}</div>
            <p>{message.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AnnouncementBoard({ platform, content }: { platform: Platform; content: string }) {
  return (
    <section className="side-board announcement-board" aria-label={`${platformNames[platform]}酒馆公告`}>
      <div className="module-heading">
        <h2>酒馆公告</h2>
      </div>
      <section className="notice announcement-content">
        <p>{renderAnnouncement(content)}</p>
      </section>
    </section>
  )
}

function Lyrics() {
  const [elapsed, setElapsed] = useState(0)
  const currentIndex = lyricIndexAt(elapsed)

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(seconds => (seconds + 1) % 192), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <section className="lyrics-board" aria-label="模拟歌词" data-lyric-index={currentIndex}>
      <div className="lyrics-heading"><span className="module-index">03 / 正在播放</span></div>
      <div className="song-title">酒馆的晚风 <span>模拟播放</span></div>
      <div className="song-progress" role="progressbar" aria-label="模拟歌曲进度" aria-valuemin={0} aria-valuemax={192} aria-valuenow={elapsed}><i style={{ width: `${elapsed / 192 * 100}%` }} /></div>
      <div className="song-time"><span>{formatTime(elapsed)}</span><span>03:12</span></div>
      <p className="lyric-line current">{lyricLines[currentIndex]}</p>
      <p className="lyric-line">{lyricLines[(currentIndex + 1) % lyricLines.length]}</p>
    </section>
  )
}

export function Overlay({
  platform,
  lyrics = true,
  board = 'comments',
  announcementText = '欢迎来到凌巽的酒馆，歇歇脚，一起聊聊今天的冒险。',
  task = '探索未知，也记得沿途歇脚。',
  benefitsText = '',
  globalFontSizes = defaultSettings.global.fontSizes,
  fontSizes = defaultSettings.platforms.bilibili.fontSizes,
}: { platform: Platform; lyrics?: boolean; board?: BoardMode; announcementText?: string; task?: string; benefitsText?: string; globalFontSizes?: GlobalFontSizes; fontSizes?: PlatformFontSizes }) {
  const fontStyle = Object.fromEntries(
    Object.entries({ ...globalFontSizes, ...fontSizes }).map(([field, size]) => [`--font-${field}`, `${size}px`]),
  ) as CSSProperties
  return (
    <main className="overlay" style={fontStyle} data-platform={platform} data-lyrics={lyrics ? 'on' : 'off'} aria-label={`${platformNames[platform]}横屏直播装饰`}>
      <header className="stream-header">
        <strong className="tavern-name">凌巽的酒馆</strong>
      </header>
      <aside className={`side-column ${lyrics ? '' : 'without-lyrics'}`}>
        {board === 'announcement' ? <AnnouncementBoard platform={platform} content={announcementText} /> : <MessageBoard platform={platform} />}
        {lyrics && <Lyrics />}
      </aside>
      <section className="stream-info" aria-label="底部酒桌">
        <section className="bottom-table today-quest" aria-label="今日委托">
          <h2 className="module-index">今日委托</h2><p title={task}>{task}</p>
        </section>
        <section className="bottom-table fan-benefits" aria-label={benefitsTitles[platform]}>
          <h2 className="module-index">{benefitsTitles[platform]}</h2><p title={benefitsText}>{benefitsText}</p>
        </section>
      </section>
    </main>
  )
}
