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

function TavernScenery() {
  return (
    <svg className="tavern-scenery" viewBox="0 0 1920 72" fill="none" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {/* A low wooden counter and two small still lifes stay below every panel. */}
      <path d="M0 50H1920V72H0Z" fill="#705039" />
      <path d="M0 50H1920V54H0Z" fill="#bc9765" />
      <path d="M0 54H1920V58H0Z" fill="#936e48" />
      <path d="M0 68H1920V72H0Z" fill="#49382c" />
      <path d="M82 60H340M430 63H576M708 60H1020M1152 63H1358M1460 60H1840" stroke="#a17a51" strokeWidth="2" />
      <path d="M364 58V68M662 58V68M1094 58V68M1420 58V68" stroke="#503c2b" strokeWidth="2" />

      <g transform="translate(76 0)">
        <path d="M0 42H88V50H0Z" fill="#627263" />
        <path d="M5 44H78V47H5Z" fill="#d3c4a0" />
        <path d="M12 32H78V42H12Z" fill="#8a5d45" />
        <path d="M18 34H72V39H18Z" fill="#d9c9a4" />
        <path d="M22 24H88V32H22Z" fill="#a18a5c" />
        <path d="M27 26H81V29H27Z" fill="#e0d1ac" />
        <path d="M106 44H144V50H106Z" fill="#63503b" />
        <path d="M114 21H136V44H114Z" fill="#e2cf9d" />
        <path d="M114 21H136V25H114Z" fill="#f2e5bf" />
        <path d="M128 25H136V44H128Z" fill="#c2a876" />
        <path d="M124 13H127V21H124Z" fill="#775338" />
        <path d="M124 2H128V6H132V13H128V17H120V9H124Z" fill="#dba45d" />
        <path d="M124 8H128V14H124Z" fill="#f6e2a2" />
        <path d="M170 25H194V46H190V50H174V46H170Z" fill="#8e9a82" />
        <path d="M194 30H204V42H194" stroke="#6f7b64" strokeWidth="4" />
        <path d="M170 23H194V28H170Z" fill="#eee3c8" />
        <path d="M175 30H180V44H175Z" fill="#bdc4a6" />
      </g>

      <g transform="translate(1636 0)">
        <path d="M0 42H9V38H18V42H27V46H36V50H0Z" fill="#b9995e" />
        <path d="M5 40H14V43H5ZM18 44H27V47H18Z" fill="#dec58e" />
        <path d="M62 21H76V31H82V47H78V50H60V47H56V31H62Z" fill="#637e70" />
        <path d="M63 17H75V23H63Z" fill="#9e7950" />
        <path d="M62 33H69V45H62Z" fill="#93ad96" />
        <path d="M110 19H142V47H110Z" fill="#68533d" />
        <path d="M114 23H138V43H114Z" fill="#c6a86e" />
        <path d="M119 28H133V43H119Z" fill="#e0c790" />
        <path d="M122 13V8H130V13M107 18H145M107 48H145" stroke="#68533d" strokeWidth="4" />
        <path d="M124 24H128V44" stroke="#866d46" strokeWidth="2" />
        <path d="M174 50V31H178V23H182V14M178 38H190V34H198M174 44H163V36H155" stroke="#697359" strokeWidth="3" />
        <path d="M180 12H190V18H180ZM185 26H196V32H185ZM193 32H203V38H193ZM151 31H162V37H151ZM160 40H170V46H160Z" fill="#86916c" />
      </g>
    </svg>
  )
}

export function Overlay({ platform, lyrics = true }: { platform: Platform; lyrics?: boolean }) {
  return (
    <main className="overlay" data-platform={platform} data-lyrics={lyrics ? 'on' : 'off'} aria-label={`${platformNames[platform]}横屏直播装饰`}>
      <TavernScenery />
      <header className="stream-header">
        <strong className="tavern-name" aria-label="凌巽的酒馆">{Array.from('凌巽的酒馆').map(character => <span key={character} aria-hidden="true">{character}</span>)}</strong>
      </header>
      <aside className={`side-column ${lyrics ? '' : 'without-lyrics'}`}>
        {platform === 'bilibili' ? <BilibiliBoard lyrics={lyrics} /> : <DouyinBoard lyrics={lyrics} />}
        {lyrics && <Lyrics />}
      </aside>
      <section className="stream-info" aria-label="今日委托">
        <div className="today-quest"><span className="module-index">04 / 今日委托</span><h2>探索未知，也记得沿途歇脚。</h2></div>
      </section>
    </main>
  )
}
