export type Platform = 'bilibili' | 'douyin'
export type BoardMode = 'comments' | 'announcement'

export const platformNames: Record<Platform, string> = {
  bilibili: 'B 站',
  douyin: '抖音',
}

const messages = {
  bilibili: [
    { kind: '留言', name: '路过的冒险者', text: '晚上好，今天也来酒馆坐坐。' },
    { kind: '礼物', name: '森林来信', text: '送来了一份小礼物。' },
    { kind: '舰长', name: '远航的朋友', text: '加入了这次旅途。' },
    { kind: 'SC', name: '山间的风', text: '愿下一段冒险，也有好风景。' },
  ],
  douyin: [
    { kind: '留言', name: '抖音的旅人', text: '从抖音过来，来酒馆歇歇脚。' },
    { kind: '礼物', name: '夜航来客', text: '送来了一份小礼物。' },
    { kind: '关注', name: '新来的朋友', text: '关注了这间酒馆。' },
    { kind: '留言', name: '晚风同行', text: '下一段冒险，也一起出发吧。' },
  ],
}

function MessageBoard({ platform, lyrics }: { platform: Platform; lyrics: boolean }) {
  return (
    <section className="side-board" aria-label={`${platformNames[platform]}留言板`}>
      <div className="module-heading">
        <div><span className="module-index">02 / 留言</span><h2>酒馆留言板</h2></div>
        <span className="sample-tag">示例</span>
      </div>
      <p className="module-description">旅人的留言，都收在这里。</p>
      <div className="messages">
        {messages[platform].slice(0, lyrics ? 3 : 4).map(message => (
          <div className="message" key={message.name}>
            <div className="message-meta"><span>{message.kind}</span><b>{message.name}</b></div>
            <p>{message.text}</p>
          </div>
        ))}
      </div>
      <div className="board-footnote">{platform === 'bilibili' ? '弹幕 · 礼物 · 舰长 · SC' : '弹幕 · 礼物 · 关注'}</div>
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
      <div className="board-footnote">公告内容示例 · 欢迎来到酒馆</div>
    </section>
  )
}

function Lyrics() {
  return (
    <section className="lyrics-board" aria-label="示例歌词">
      <div className="lyrics-heading"><span className="module-index">03 / 正在播放</span><span className="sample-tag">示例</span></div>
      <div className="song-title">酒馆的晚风 <span>原创占位文字</span></div>
      <p className="lyric-line current">把今天的故事，留在这里</p>
      <p className="lyric-line">下一段旅程，慢慢开启</p>
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
        {board === 'announcement' ? <AnnouncementBoard platform={platform} /> : <MessageBoard platform={platform} lyrics={lyrics} />}
        {lyrics && <Lyrics />}
      </aside>
      <section className="stream-info" aria-label="今日委托">
        <div className="today-quest"><span className="module-index">04 / 今日委托</span><h2>探索未知，也记得沿途歇脚。</h2></div>
      </section>
    </main>
  )
}
