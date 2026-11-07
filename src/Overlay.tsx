export type Platform = 'bilibili' | 'douyin'

export const platformNames: Record<Platform, string> = {
  bilibili: 'B 站',
  douyin: '抖音',
}

const messages = [
  { kind: '留言', name: '路过的冒险者', text: '晚上好，今天也来酒馆坐坐。' },
  { kind: '礼物', name: '森林来信', text: '送来了一份小礼物。' },
  { kind: '舰长', name: '远航的朋友', text: '加入了这次旅途。' },
  { kind: 'SC', name: '山间的风', text: '愿下一段冒险，也有好风景。' },
]

function BilibiliBoard({ lyrics }: { lyrics: boolean }) {
  return (
    <section className="side-board" aria-label="B 站留言板">
      <div className="module-heading">
        <div><span className="module-index">02 / 留言</span><h2>酒馆留言板</h2></div>
        <span className="sample-tag">示例</span>
      </div>
      <p className="module-description">旅人的留言，都收在这里。</p>
      <div className="messages">
        {messages.slice(0, lyrics ? 3 : 4).map(message => (
          <div className="message" key={message.kind}>
            <div className="message-meta"><span>{message.kind}</span><b>{message.name}</b></div>
            <p>{message.text}</p>
          </div>
        ))}
      </div>
      <div className="board-footnote">弹幕 · 礼物 · 舰长 · SC</div>
    </section>
  )
}

function DouyinBoard({ lyrics }: { lyrics: boolean }) {
  return (
    <section className="side-board" aria-label="抖音任务与公告">
      <div className="module-heading">
        <div><span className="module-index">02 / 委托</span><h2>公会告示板</h2></div>
        <span className="sample-tag">示例</span>
      </div>
      <p className="module-description">今天的旅途，从一份委托开始。</p>
      <div className="quest">
        <span className="small-label">进行中的委托</span>
        <h3>探索下一片大陆</h3>
        <p>慢慢走，把沿途的风景带回来。</p>
        <div className="quest-progress"><i /></div>
        <div className="quest-count"><span>旅途进度 · 示例</span><span>1 / 3</span></div>
      </div>
      <div className="notice"><span className="small-label">酒馆公告</span><p>欢迎歇歇脚，陪我一起冒险。</p></div>
      {!lyrics && <div className="notice extra-notice"><span className="small-label">下一个目的地</span><p>留一点时间，探索地图的另一边。</p></div>}
      <div className="board-footnote">任务 · 公告</div>
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

export function Overlay({ platform, lyrics = true }: { platform: Platform; lyrics?: boolean }) {
  return (
    <main className="overlay" data-platform={platform} data-lyrics={lyrics ? 'on' : 'off'} aria-label={`${platformNames[platform]}横屏直播装饰`}>
      <header className="stream-header">
        <div className="tavern-name"><span className="tavern-mark" aria-hidden="true">巽</span><strong>凌巽的酒馆</strong></div>
        <div className="stream-topic"><span>今夜的旅程</span><b>探索下一片大陆</b></div>
        <div className="stream-platform"><span className="square-dot" />{platformNames[platform]} · 横屏</div>
      </header>
      <aside className={`side-column ${lyrics ? '' : 'without-lyrics'}`}>
        {platform === 'bilibili' ? <BilibiliBoard lyrics={lyrics} /> : <DouyinBoard lyrics={lyrics} />}
        {lyrics && <Lyrics />}
      </aside>
      <section className="stream-info" aria-label="今日委托与主播信息">
        <div className="today-quest"><span className="module-index">04 / 今日委托</span><h2>探索未知，也记得沿途歇脚。</h2></div>
        <div className="decoration-slot"><span className="decoration-placeholder" aria-hidden="true" /><span>主播信息<br /><small>装饰预留</small></span></div>
      </section>
      <footer className="stream-footer"><span>LINGXUN’S TAVERN</span><span>布局线框 · 示例内容</span><span>{platformNames[platform]} / 1920 × 1080</span></footer>
    </main>
  )
}
