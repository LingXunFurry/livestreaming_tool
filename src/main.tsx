import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Overlay, platformNames } from './Overlay'
import type { BoardMode, Platform, GlobalFontSizes, PlatformFontSizes } from './Overlay'
import defaultSettings from '../config/example.json'
import { disconnectedMusic, type MusicState } from './music'
import { Admin } from './Admin'
import { AssetReview } from './AssetReview'
import sceneLayout from '../assets/layouts/cp3-tavern.json'
import './scene-review.css'
import './styles.css'

const sceneBackground = new URL('../assets/backgrounds/cp3-tavern.png', import.meta.url).href
const sceneTitle = new URL('../assets/generated/cp3/tavern-wordmark.png', import.meta.url).href

const sceneAssets = [
  { name: '酒馆标题艺术字', size: '384 × 128', image: sceneTitle },
  { name: '梁架与悬挂陈设组', size: '320 × 80', image: new URL('../assets/generated/cp3/tavern-canopy.png', import.meta.url).href },
  { name: '吧台与供酒陈设组', size: '640 × 128', image: new URL('../assets/generated/cp3/tavern-counter.png', import.meta.url).href },
  { name: '右上酒桶挂杯陈设组', size: '256 × 80', image: new URL('../assets/generated/cp3/tavern-right-rack.png', import.meta.url).href },
  { name: '留言板中英文艺术字', size: '288 × 96', image: new URL('../assets/generated/cp3/comment-wordmark.png', import.meta.url).href },
  { name: '正在播放中英文艺术字', size: '240 × 80', image: new URL('../assets/generated/cp3/playing-wordmark.png', import.meta.url).href },
  { name: '酒馆公告中英文艺术字', size: '288 × 96', image: new URL('../assets/generated/cp3/announcement-wordmark.png', import.meta.url).href },
  { name: '木墙纹理', size: '64 × 64', image: new URL('../assets/generated/cp3/tavern-wall-tile.png', import.meta.url).href },
  { name: '木地板纹理', size: '64 × 64', image: new URL('../assets/generated/cp3/tavern-floor-tile.png', import.meta.url).href },
  { name: '横向木梁', size: '128 × 32', image: new URL('../assets/generated/cp3/timber-beam.png', import.meta.url).href },
  { name: '挂灯', size: '32 × 64', image: new URL('../assets/generated/cp3/hanging-lantern.png', import.meta.url).href },
  { name: '酒瓶架', size: '128 × 64', image: new URL('../assets/generated/cp3/bottle-shelf.png', import.meta.url).href },
  { name: '酒桶', size: '64 × 64', image: new URL('../assets/generated/cp3/barrel.png', import.meta.url).href },
]

const params = new URLSearchParams(window.location.search)
const path = window.location.pathname.replace(/\/$/, '') || '/'
const sourcePlatform: Platform | null = path === '/live/bilibili' ? 'bilibili' : path === '/live/douyin' ? 'douyin' : null
document.documentElement.dataset.surface = sourcePlatform ? 'source' : 'review'

function Preview({ scene = false }: { scene?: boolean }) {
  const [platform, setPlatform] = useState<Platform>(params.get('platform') === 'douyin' ? 'douyin' : 'bilibili')
  const [lyrics, setLyrics] = useState(params.get('lyrics') !== 'off')
  const [guides, setGuides] = useState(!scene)
  const [showUI, setShowUI] = useState(true)
  const [background, setBackground] = useState('transparent')
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
        <a className="project-brand" href="/preview" aria-label="凌巽的酒馆布局预览首页"><span className="brand-grid" aria-hidden="true"><i /><i /><i /><i /></span><span>凌巽的酒馆 <small>OVERLAY WORKSHOP</small></span></a>
        <span className="checkpoint-status"><span /> {scene ? 'V2 CP3 · 等待场景验收' : 'V2 CP1 · 已通过'}</span>
      </header>

      <div className="intro">
        <div><p className="eyebrow">{scene ? 'CHECKPOINT 03 / TAVERN SCENE' : 'CHECKPOINT 01 / LAYOUT'}</p><h1>凌巽的酒馆 · {scene ? '像素场景返修' : '横屏布局线框'}</h1><p className="intro-description">{scene ? '梁架、旗帜与供酒吧台。切换 UI，查看独立背景与艺术字叠加的效果。' : '复核 1920 × 1080 双平台布局，保留已确认的区域位置与比例。'}</p></div>
        <div className="phase-note"><span>当前阶段</span><strong>{scene ? 'CP3 · 酒馆场景' : 'CP1 · 横屏布局'}</strong><small>{scene ? '布局已通过 · 场景等待验收' : '美术与场景素材另行验收'}</small></div>
      </div>

      <section className="review-workspace" aria-label="直播布局预览">
        <div className="preview-toolbar">
          <div className="platform-switch" role="group" aria-label="选择预览平台">
            <button aria-pressed={platform === 'bilibili'} onClick={() => setPlatform('bilibili')}>B 站</button>
            <button aria-pressed={platform === 'douyin'} onClick={() => setPlatform('douyin')}>抖音</button>
          </div>
          <div className="preview-options">
            {scene && <label><input type="checkbox" checked={showUI} onChange={event => setShowUI(event.target.checked)} />叠加 UI</label>}
            <label><input type="checkbox" checked={lyrics} onChange={event => setLyrics(event.target.checked)} />显示歌词</label>
            <label><input type="checkbox" checked={guides} onChange={event => setGuides(event.target.checked)} />尺寸参考</label>
            <label className="background-picker">透明区底图<select aria-label="预览底图" value={background} onChange={event => setBackground(event.target.value)}><option value="transparent">透明棋盘</option><option value="solid">纯色</option></select></label>
          </div>
          <a className="open-source" href={scene ? sceneBackground : sourceUrl} download={scene ? 'cp3-tavern.png' : undefined} target={scene ? undefined : '_blank'} rel="noreferrer">{scene ? '下载无 UI 背景' : '打开透明源'} <span aria-hidden="true">↗</span></a>
        </div>

        <div className="canvas-surround">
          <div className="canvas-caption"><span>{platformNames[platform]} / {lyrics ? '歌词开启' : '歌词关闭'}</span><span>1920 × 1080 <b>16:9</b></span></div>
          <div ref={stageRef} className={`preview-stage ${background !== 'solid' ? 'checkerboard' : 'solid-stage'}`}>
            <div className={`scaled-stage ${scene ? 'scene-preview' : ''}`} style={{ transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
              {scene && <img className="scene-background" src={sceneBackground} width="1920" height="1080" alt="模块化酒馆背景，游戏窗口透明" />}
              {(!scene || showUI) && <Overlay platform={platform} lyrics={lyrics} />}
              {scene && showUI && <img className="scene-title-art" src={sceneTitle} width="384" height="128" alt="凌巽的酒馆" />}
              {(!scene || guides) && <div className={`game-guide ${guides ? 'with-guides' : ''}`} aria-label="仅预览显示的透明游戏区">
                {guides && <><span className="game-dimension">01 / 游戏画面</span><span className="corner top-left" /><span className="corner top-right" /><span className="corner bottom-left" /><span className="corner bottom-right" /></>}
                <div className="game-guide-content"><span className="crosshair" aria-hidden="true" /><h2>把游戏，放在这里。</h2><p>1280 × 720 <span>·</span> 16:9 透明区域</p><small>游戏由直播软件捕获，本页只叠加装饰。</small></div>
                {guides && <span className="game-coordinate">X 40 / Y 144</span>}
              </div>}
            </div>
          </div>
          <div className="canvas-footer"><span><i /> 棋盘格与尺寸参考仅用于预览</span><span>按窗口等比缩放 · {Math.round(scale * 100)}%</span></div>
        </div>
      </section>

      {scene && <section className="scene-assets" aria-label="CP3 独立场景素材">
        <div className="scene-assets-heading"><div><p className="eyebrow">CP3 / INDEPENDENT ASSETS</p><h2>梁架、吧台与酒馆字样。</h2><p>前七件为返修新稿，其余为首版独立模块，均等待美术验收。</p></div><a href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(sceneLayout, null, 2))}`} download="cp3-tavern.json">下载物件布局 JSON ↗</a></div>
        <div className="scene-asset-grid">{sceneAssets.map(asset => <article key={asset.name}>
          <div className="scene-asset-stage checkerboard"><img src={asset.image} alt={`${asset.name}独立像素素材`} /></div>
          <h3>{asset.name}</h3><p>{asset.size} px</p><a href={asset.image} download={`${asset.name}.png`}>下载 PNG ↗</a>
        </article>)}</div>
      </section>}

      {scene && <p className="scene-font-note">栏目文字采用 Fusion Pixel Font 10px 简中比例版 · TakWolf · OFL-1.1。<a href={new URL('../assets/fonts/fusion-pixel/OFL.txt', import.meta.url).href}>字体许可</a> · <a href={new URL('../assets/fonts/fusion-pixel/LICENSES/ark-pixel/OFL.txt', import.meta.url).href}>Ark Pixel</a> · <a href={new URL('../assets/fonts/fusion-pixel/LICENSES/boutique-bitmap-9x9/OFL.txt', import.meta.url).href}>Boutique Bitmap</a> · <a href={new URL('../assets/fonts/fusion-pixel/LICENSES/galmuri/LICENSE.txt', import.meta.url).href}>Galmuri</a></p>}

      <div className="review-details">
        <section className="layout-notes" aria-labelledby="layout-notes-title"><p className="eyebrow">APPROVED LAYOUT</p><h2 id="layout-notes-title">已确认的区域比例。</h2>
          <ol><li><span>01</span><div><h3>完整游戏区</h3><p>1280 × 720，16∶9 透明窗口。</p></div></li><li><span>02</span><div><h3>双平台右栏</h3><p>宽 528px，同一套外观，各自显示本平台留言。</p></div></li><li><span>03</span><div><h3>歌词开关</h3><p>关闭后右侧主面板扩展。当前均为示例内容。</p></div></li></ol>
        </section>
        <section className="source-notes" aria-labelledby="source-notes-title"><p className="eyebrow">TWO INDEPENDENT SOURCES</p><h2 id="source-notes-title">同一间酒馆，两个窗口。</h2><p>这两个地址可同时打开。直播软件中的网页素材尺寸均设为 1920 × 1080。</p>
          <a href="/live/bilibili" target="_blank" rel="noreferrer"><strong>B 站</strong><code>/live/bilibili</code><span aria-hidden="true">↗</span></a>
          <a href="/live/douyin" target="_blank" rel="noreferrer"><strong>抖音</strong><code>/live/douyin</code><span aria-hidden="true">↗</span></a>
          <small>当前为美术原型与示例内容，尚未接入平台互动或音乐。</small>
        </section>
      </div>
      <footer className="review-footer"><span>CP0 · CP1 · CP2 已通过 <b>→</b> CP3 场景验收</span><a href={scene ? '/preview' : '/scene/review'}>{scene ? '查看 CP1 布局 ↗' : '查看 CP3 场景 ↗'}</a><a href="/assets/review">CP2 素材 ↗</a><a href="/admin">实际系统状态 ↗</a></footer>
    </div>
  )
}

type SourceSettings = {
  global: { task: string; fontSizes: GlobalFontSizes }
  platforms: Record<Platform, { boardMode: BoardMode; announcementText: string; lyricsEnabled: boolean; lyricsAutoHide: boolean; bottomAnnouncementText: string; fontSizes: PlatformFontSizes }>
}

const defaultSourceSettings: SourceSettings = {
  global: { task: '探索未知，也记得沿途歇脚。', fontSizes: defaultSettings.global.fontSizes },
  platforms: {
    bilibili: { boardMode: 'comments', announcementText: '欢迎来到凌巽的酒馆，歇歇脚，一起聊聊今天的冒险。', lyricsEnabled: true, lyricsAutoHide: false, bottomAnnouncementText: '', fontSizes: defaultSettings.platforms.bilibili.fontSizes },
    douyin: { boardMode: 'comments', announcementText: '欢迎来到凌巽的酒馆，歇歇脚，一起聊聊今天的冒险。', lyricsEnabled: true, lyricsAutoHide: false, bottomAnnouncementText: '', fontSizes: defaultSettings.platforms.douyin.fontSizes },
  },
}

function SourcePage({ platform }: { platform: Platform }) {
  const [settings, setSettings] = useState(defaultSourceSettings)
  const [music, setMusic] = useState<MusicState>(disconnectedMusic)

  useEffect(() => {
    let disposed = false
    let receivedSettingsUpdate = false
    let socket: WebSocket | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let musicExpiry: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()

    async function readSettings() {
      try {
        const response = await fetch('/api/settings', { signal: controller.signal })
        if (!response.ok) return
        const result = await response.json()
        if (!disposed && !receivedSettingsUpdate && result.settings) setSettings(result.settings)
      } catch { /* Keep the bundled defaults until the local service responds. */ }
    }

    function connect() {
      if (disposed) return
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`)
      socket.onopen = () => {
        receivedSettingsUpdate = false
        void readSettings()
      }
      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data)
          const update = message.data
          if (!disposed && message.type === 'music.updated' && update) {
            setMusic(update)
            clearTimeout(musicExpiry)
            if (update.state !== 'DISCONNECTED') musicExpiry = setTimeout(() => setMusic({ ...disconnectedMusic, state: 'UNAVAILABLE' }), 5000)
          }
          if (!disposed && message.type === 'settings.updated' && update?.platform === platform) {
            receivedSettingsUpdate = true
            setSettings(current => ({
              global: update.global,
              platforms: { ...current.platforms, [platform]: update.platformSettings },
            }))
          }
        } catch { /* Ignore malformed messages and keep the last valid settings. */ }
      }
      socket.onclose = () => {
        if (disposed) return
        clearTimeout(musicExpiry)
        setMusic({ ...disconnectedMusic, state: 'UNAVAILABLE' })
        void readSettings()
        retry = setTimeout(connect, 2000)
      }
    }

    void readSettings()
    connect()
    return () => {
      disposed = true
      controller.abort()
      clearTimeout(retry)
      clearTimeout(musicExpiry)
      socket?.close()
    }
  }, [platform])

  const platformSettings = settings.platforms[platform]
  const showMusic = platformSettings.lyricsEnabled && (!platformSettings.lyricsAutoHide || (music.state === 'CONNECTED' && music.playing))
  return (
    <main className="source-stage scene-preview" aria-label={`${platformNames[platform]}酒馆直播源`}>
      <img className="scene-background" src={sceneBackground} width="1920" height="1080" alt="已验收模块化酒馆背景，游戏窗口透明" />
      <Overlay platform={platform} lyrics={showMusic} task={settings.global.task} bottomAnnouncementText={platformSettings.bottomAnnouncementText} globalFontSizes={settings.global.fontSizes} fontSizes={platformSettings.fontSizes} music={music} />
      <img className="scene-title-art" src={sceneTitle} width="384" height="128" alt="凌巽的酒馆" />
    </main>
  )
}

function UnavailablePage() {
  const admin = path === '/admin'
  return <div className="unavailable-page"><p className="eyebrow">LINGXUN’S TAVERN</p><h1>{admin ? '管理后台还没开工。' : '这扇门还没有打开。'}</h1><p>{admin ? '横屏布局已通过。统一管理后台安排在 CP5。' : '请从布局验收页进入两个直播源。'}</p><a href="/preview">返回布局验收 ↗</a></div>
}

if (sourcePlatform) document.title = `凌巽的酒馆 · ${platformNames[sourcePlatform]}直播页 · CP6`
if (path === '/assets/review') document.title = '凌巽的酒馆 · CP2 像素素材验收'
if (path === '/scene/review') document.title = '凌巽的酒馆 · CP3 场景验收'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {sourcePlatform ? <SourcePage platform={sourcePlatform} /> : path === '/assets/review' ? <AssetReview /> : path === '/scene/review' ? <Preview scene /> : path === '/admin' ? <Admin /> : (path === '/' || path === '/preview') ? <Preview /> : <UnavailablePage />}
  </StrictMode>,
)
