import { useEffect, useRef, useState } from 'react'
import { appendSimulatedMessage, eventTimeline, initialMessages, lyricIndexAt, lyricLines, messageLabels } from './simulation'
import type { SimulatedMessage } from './simulation'

export type Platform = 'bilibili' | 'douyin'
export type BoardMode = 'comments' | 'announcement'

export const platformNames: Record<Platform, string> = {
  bilibili: 'B 站',
  douyin: '抖音',
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
        <div><span className="module-index">02 / 留言</span><h2>酒馆留言板</h2></div>
        <span className="sample-tag">示例</span>
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

function AnnouncementBoard({ platform }: { platform: Platform }) {
  return (
    <section className="side-board announcement-board" aria-label={`${platformNames[platform]}酒馆公告`}>
      <div className="module-heading">
        <h2>酒馆公告</h2>
        <span className="sample-tag">示例</span>
      </div>
      <p className="module-description">给每位途经酒馆的旅人。</p>
      <section className="notice">
        <h3 className="small-label">欢迎歇脚</h3>
        <p>欢迎来到凌巽的酒馆，歇歇脚，一起聊聊今天的冒险。</p>
      </section>
      <section className="notice">
        <h3 className="small-label">店内小约定</h3>
        <p>友好交流，尊重彼此。愿每位旅人都能度过轻松的一晚。</p>
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
      <div className="lyrics-heading"><span className="module-index">03 / 正在播放</span><span className="sample-tag">示例</span></div>
      <div className="song-title">酒馆的晚风 <span>模拟播放</span></div>
      <div className="song-progress" role="progressbar" aria-label="模拟歌曲进度" aria-valuemin={0} aria-valuemax={192} aria-valuenow={elapsed}><i style={{ width: `${elapsed / 192 * 100}%` }} /></div>
      <div className="song-time"><span>{formatTime(elapsed)}</span><span>03:12</span></div>
      <p className="lyric-line current">{lyricLines[currentIndex]}</p>
      <p className="lyric-line">{lyricLines[(currentIndex + 1) % lyricLines.length]}</p>
    </section>
  )
}

export function Overlay({ platform, lyrics = true, board = 'comments' }: { platform: Platform; lyrics?: boolean; board?: BoardMode }) {
  return (
    <main className="overlay" data-platform={platform} data-lyrics={lyrics ? 'on' : 'off'} aria-label={`${platformNames[platform]}横屏直播装饰`}>
      <header className="stream-header">
        <strong className="tavern-name">凌巽的酒馆</strong>
      </header>
      <aside className={`side-column ${lyrics ? '' : 'without-lyrics'}`}>
        {board === 'announcement' ? <AnnouncementBoard platform={platform} /> : <MessageBoard platform={platform} />}
        {lyrics && <Lyrics />}
      </aside>
      <section className="stream-info" aria-label="今日委托">
        <div className="today-quest"><span className="module-index">04 / 今日委托</span><h2>探索未知，也记得沿途歇脚。</h2></div>
      </section>
    </main>
  )
}
