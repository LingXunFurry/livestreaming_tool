import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Overlay, platformNames } from './Overlay'
import type { Platform } from './Overlay'
import './styles.css'

const params = new URLSearchParams(window.location.search)
const path = window.location.pathname.replace(/\/$/, '') || '/'
const sourcePlatform: Platform | null = path === '/live/bilibili' ? 'bilibili' : path === '/live/douyin' ? 'douyin' : null
document.documentElement.dataset.surface = sourcePlatform ? 'source' : 'review'

function Preview() {
  const [platform, setPlatform] = useState<Platform>(params.get('platform') === 'douyin' ? 'douyin' : 'bilibili')
  const [lyrics, setLyrics] = useState(params.get('lyrics') !== 'off')
  const [guides, setGuides] = useState(true)
  const [checkerboard, setCheckerboard] = useState(true)
  const [scale, setScale] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const sourceUrl = `/live/${platform}${lyrics ? '' : '?lyrics=off'}`

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1920))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('platform', platform)
    url.searchParams.set('lyrics', lyrics ? 'on' : 'off')
    window.history.replaceState(null, '', url)
  }, [platform, lyrics])

  return (
    <div className="review-shell">
      <header className="review-header">
        <a className="project-brand" href="/preview" aria-label="凌巽的酒馆布局验收首页"><span className="brand-grid" aria-hidden="true"><i /><i /><i /><i /></span><span>凌巽的酒馆 <small>OVERLAY WORKSHOP</small></span></a>
        <span className="checkpoint-status"><span /> CP1 · 待验收</span>
      </header>

      <div className="intro">
        <div><p className="eyebrow">CHECKPOINT 01 / LAYOUT</p><h1>先给冒险，留好位置。</h1><p className="intro-description">这一轮看比例和布局。游戏留在左边，酒馆的故事放在右边。</p></div>
        <div className="phase-note"><span>当前阶段</span><strong>横屏布局 · 局部装饰试样</strong><small>本轮查看艺术字标题与底部留白</small></div>
      </div>

      <section className="review-workspace" aria-label="直播布局预览">
        <div className="preview-toolbar">
          <div className="platform-switch" role="group" aria-label="选择预览平台">
            <button aria-pressed={platform === 'bilibili'} onClick={() => setPlatform('bilibili')}>B 站</button>
            <button aria-pressed={platform === 'douyin'} onClick={() => setPlatform('douyin')}>抖音</button>
          </div>
          <div className="preview-options">
            <label><input type="checkbox" checked={lyrics} onChange={event => setLyrics(event.target.checked)} />显示歌词</label>
            <label><input type="checkbox" checked={guides} onChange={event => setGuides(event.target.checked)} />尺寸参考</label>
            <label><input type="checkbox" checked={checkerboard} onChange={event => setCheckerboard(event.target.checked)} />透明棋盘</label>
          </div>
          <a className="open-source" href={sourceUrl} target="_blank" rel="noreferrer">打开透明源 <span aria-hidden="true">↗</span></a>
        </div>

        <div className="canvas-surround">
          <div className="canvas-caption"><span>{platformNames[platform]} / {lyrics ? '歌词开启' : '歌词关闭'}</span><span>1920 × 1080 <b>16:9</b></span></div>
          <div ref={stageRef} className={`preview-stage ${checkerboard ? 'checkerboard' : 'solid-stage'}`}>
            <div className="scaled-stage" style={{ transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
              <Overlay platform={platform} lyrics={lyrics} />
              <div className={`game-guide ${guides ? 'with-guides' : ''}`} aria-label="仅预览显示的透明游戏区">
                {guides && <><span className="game-dimension">01 / 游戏画面</span><span className="corner top-left" /><span className="corner top-right" /><span className="corner bottom-left" /><span className="corner bottom-right" /></>}
                <div className="game-guide-content"><span className="crosshair" aria-hidden="true" /><h2>把游戏，放在这里。</h2><p>1280 × 720 <span>·</span> 16:9 透明区域</p><small>游戏由直播软件捕获，本页只叠加装饰。</small></div>
                {guides && <span className="game-coordinate">X 40 / Y 144</span>}
              </div>
            </div>
          </div>
          <div className="canvas-footer"><span><i /> 棋盘格和游戏占位文字仅用于预览</span><span>按窗口等比缩放 · {Math.round(scale * 100)}%</span></div>
        </div>
      </section>

      <div className="review-details">
        <section className="layout-notes" aria-labelledby="layout-notes-title"><p className="eyebrow">THE LAYOUT</p><h2 id="layout-notes-title">这一版，先看三个地方。</h2>
          <ol><li><span>01</span><div><h3>游戏区的占比</h3><p>保留完整 16:9，文字和装饰都在游戏画面之外。</p></div></li><li><span>02</span><div><h3>右侧的阅读空间</h3><p>宽 528px；B 站放留言，抖音放任务和公告。</p></div></li><li><span>03</span><div><h3>歌词开关后的平衡</h3><p>关掉歌词，右侧功能区自然展开，不留空洞。</p></div></li></ol>
        </section>
        <section className="source-notes" aria-labelledby="source-notes-title"><p className="eyebrow">TWO INDEPENDENT SOURCES</p><h2 id="source-notes-title">同一间酒馆，两个窗口。</h2><p>这两个地址可同时打开。直播软件中的网页素材尺寸均设为 1920 × 1080。</p>
          <a href="/live/bilibili" target="_blank" rel="noreferrer"><strong>B 站</strong><code>/live/bilibili</code><span aria-hidden="true">↗</span></a>
          <a href="/live/douyin" target="_blank" rel="noreferrer"><strong>抖音</strong><code>/live/douyin</code><span aria-hidden="true">↗</span></a>
          <small>当前为线框与示例内容，尚未接入平台互动或音乐。</small>
        </section>
      </div>
      <footer className="review-footer"><span>01 布局线框 <b>→</b> 02 像素酒馆美术 <b>→</b> 03 右侧功能区</span><span>本阶段验收后，再继续下一步。</span></footer>
    </div>
  )
}

function UnavailablePage() {
  const admin = path === '/admin'
  return <div className="unavailable-page"><p className="eyebrow">LINGXUN’S TAVERN</p><h1>{admin ? '管理后台还没开工。' : '这扇门还没有打开。'}</h1><p>{admin ? '当前停在 CP1 布局验收。统一管理后台安排在 CP5。' : '请从布局验收页进入两个直播源。'}</p><a href="/preview">返回布局验收 ↗</a></div>
}

if (sourcePlatform) document.title = `凌巽的酒馆 · ${platformNames[sourcePlatform]}透明源 · CP1`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {sourcePlatform ? <Overlay platform={sourcePlatform} lyrics={params.get('lyrics') !== 'off'} /> : (path === '/' || path === '/preview') ? <Preview /> : <UnavailablePage />}
  </StrictMode>,
)
