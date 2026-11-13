import { useEffect, useState } from 'react'
import { type BoardMode, type Platform, type GlobalFontSizes, type PlatformFontSizes } from './Overlay'
import fontSizeLimits from '../config/font-sizes.json'
import { disconnectedMusic, musicStatusLabel, type MusicState } from './music'

interface RuntimeStatus {
  service: string
  state: string
  version: string
  checkpoint: string
  startedAt: string
  port: number
  pages: Record<'bilibili' | 'douyin' | 'admin', string>
  websocket: { state: string; clients: number }
  adapters: Record<string, { state: string; error?: string; eventCount?: number; suppressedReplays?: number; lastEventAt?: string; room?: {onlineCount: number | null; likeCount: number | null} }>
  configuration: { title: string; task: string; schemaVersion: number }
}

interface EditableSettings {
  global: { task: string; fontSizes: GlobalFontSizes }
  music: { enabled: boolean; baseUrl: string }
  platforms: Record<Platform, { collector: {url: string; executable: string; autoStart: boolean}; snifferEnabled?: boolean; roomAddress?: string; boardMode?: BoardMode; announcementText: string; lyricsEnabled: boolean; lyricsAutoHide: boolean; bottomAnnouncementText: string; fontSizes: PlatformFontSizes }>
}

const platformLabels: Record<Platform, string> = { bilibili: 'B 站', douyin: '抖音' }

function adapterStateLabel(state?: string) {
  return ({
    NOT_CONFIGURED: '未配置',
    WAITING_AUTHORIZATION: '等待平台授权',
    CONNECTED: '连接可用',
    DISCONNECTED: '未连接',
    CONNECTING: '连接中',
    UNAVAILABLE: '暂不可用',
  } as Record<string, string>)[state || ''] || state || '等待响应'
}

function FontSizeControl({ name, label, value, onChange }: {
  name: keyof typeof fontSizeLimits; label: string; value: number; onChange: (size: number) => void
}) {
  const { min, max } = fontSizeLimits[name]
  return <label className="admin-font-size">
    <span>{label}<output>{value}px</output></span>
    <input type="range" aria-label={label} min={min} max={max} step={1} value={value}
      onChange={event => onChange(Number(event.target.value))} />
  </label>
}

export function Admin() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null)
  const [settings, setSettings] = useState<EditableSettings | null>(null)
  const [connection, setConnection] = useState('CONNECTING')
  const [saveState, setSaveState] = useState('')
  const [error, setError] = useState('')
  const [music, setMusic] = useState<MusicState>(disconnectedMusic)
  const [musicAction, setMusicAction] = useState(false)
  const [musicActionError, setMusicActionError] = useState('')
  const [collectionAction, setCollectionAction] = useState('')

  useEffect(() => {
    let disposed = false
    let socket: WebSocket | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()

    async function readAdminData() {
      try {
        const [statusResponse, settingsResponse] = await Promise.all([
          fetch('/api/runtime/status', { signal: controller.signal }),
          fetch('/api/settings', { signal: controller.signal }),
        ])
        if (!statusResponse.ok || !settingsResponse.ok) throw new Error('本地服务暂时不可达')
        const nextStatus = await statusResponse.json()
        const nextSettings = await settingsResponse.json()
        if (!disposed) {
          setStatus(nextStatus)
          setSettings(nextSettings.settings)
          setError('')
        }
      } catch {
        if (!disposed) {
          setStatus(null)
          setError('本地服务暂时不可达，正在等待重新连接。可通过启动入口检查服务。')
        }
      }
    }

    function connect() {
      if (disposed) return
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`)
      socket.onopen = () => { if (!disposed) setConnection('CONNECTED') }
      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data)
          if (disposed) return
          if (message.type === 'music.updated' && message.data) setMusic(message.data)
          if (message.type === 'runtime.status' && message.data?.service === 'lingxun-tavern') {
            setStatus(message.data)
            setError('')
          }
          if (message.type === 'settings.updated' && message.data?.global && message.data?.platformSettings) {
            setSettings(current => current ? {
              ...current,
              global: message.data.global,
              music: message.data.music || current.music,
              platforms: { ...current.platforms, [message.data.platform]: message.data.platformSettings },
            } : current)
          }
        } catch { /* Keep the last valid snapshot. */ }
      }
      socket.onclose = () => {
        if (disposed) return
        setConnection('DISCONNECTED')
        setMusic({ ...disconnectedMusic, state: 'UNAVAILABLE' })
        void readAdminData()
        retry = setTimeout(connect, 2000)
      }
      socket.onerror = () => { if (!disposed) setConnection('DISCONNECTED') }
    }

    void readAdminData()
    connect()
    return () => {
      disposed = true
      controller.abort()
      clearTimeout(retry)
      socket?.close()
    }
  }, [])

  const updatePlatform = (platform: Platform, update: Partial<EditableSettings['platforms'][Platform]>) => {
    setSettings(current => current ? { ...current, platforms: { ...current.platforms, [platform]: { ...current.platforms[platform], ...update } } } : current)
  }

  function updateFontSize(platform: Platform, field: keyof PlatformFontSizes, size: number) {
    if (!settings) return
    updatePlatform(platform, { fontSizes: { ...settings.platforms[platform].fontSizes, [field]: size } })
    setSaveState('')
  }

  async function save() {
    if (!settings) return
    setSaveState('保存中')
    setError('')
    try {
      const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '配置保存失败')
      setSettings(result.settings)
      setSaveState('已保存')
      return true
    } catch (saveError) {
      setSaveState('')
      setError(saveError instanceof Error ? saveError.message : '配置保存失败')
      return false
    }
  }

  async function controlCollection(platform: Platform, action: 'start' | 'stop') {
    setCollectionAction(platform)
    try {
      if (action === 'start' && !await save()) return
      const response = await fetch(`/api/interaction/${platform}/${action}`, {method: 'POST'})
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
    } catch (error) { setError(error instanceof Error ? error.message : '采集操作失败') }
    finally { setCollectionAction('') }
  }

  async function controlMusic(action: 'prev' | 'next' | 'playpause') {
    setMusicAction(true)
    setMusicActionError('')
    try {
      const response = await fetch('/api/music/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      if (!response.ok) throw new Error()
    } catch { setMusicActionError('音乐操作未成功，请检查网易云与本地桥接。') }
    finally { setMusicAction(false) }
  }

  const startTime = status ? new Date(status.startedAt).toLocaleString('zh-CN') : '等待服务响应'
  const displayState = error && !settings ? 'ERROR' : connection === 'DISCONNECTED' && status ? 'DEGRADED' : status?.state || 'CONNECTING'

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p className="eyebrow">SYSTEM / CP7 CONTROL</p><h1>凌巽的酒馆 · 管理后台</h1></div>
        <span className="admin-state">{displayState}</span>
      </header>
      <p className="admin-intro">这里显示本地服务与双平台互动接入状态，并管理底部酒桌和平台设置。</p>
      {error && <p className="admin-error" role="alert">{error}</p>}

      <section className="admin-grid" aria-label="本地系统状态">
        <div><h2>本地服务</h2><dl><dt>服务状态</dt><dd>{status?.state || '等待响应'}</dd><dt>版本</dt><dd>{status?.version || '—'}</dd><dt>监听端口</dt><dd>{status?.port || '—'}</dd><dt>启动时间</dt><dd>{startTime}</dd></dl></div>
        <div><h2>状态连接</h2><dl><dt>WebSocket 服务</dt><dd>{status?.websocket.state || '等待响应'}</dd><dt>当前页面连接</dt><dd>{connection}</dd><dt>连接数量</dt><dd>{status?.websocket.clients ?? '—'}</dd><dt>当前阶段</dt><dd>{status?.checkpoint || '等待响应'}</dd></dl></div>
        <div><h2>外部适配器</h2><dl><dt>网易云</dt><dd>{adapterStateLabel(status?.adapters.music?.state)}</dd><dt>B 站互动</dt><dd>{adapterStateLabel(status?.adapters.bilibili?.state)}</dd><dt>抖音页面</dt><dd>固定公告</dd></dl><p>采集器连接后，消息计数会随实际接收的事件增加。</p></div>
        <div><h2>本地配置</h2><dl><dt>配置标题</dt><dd>{status?.configuration.title || '等待响应'}</dd><dt>今日委托</dt><dd>{status?.configuration.task || '等待响应'}</dd><dt>配置版本</dt><dd>{status?.configuration.schemaVersion ?? '—'}</dd></dl><p>普通设置保存到 data/settings.json，旧版本保存在 data/backups/。</p></div>
      </section>

      <section className="admin-settings" aria-labelledby="admin-settings-title">
        <div className="admin-settings-heading"><div><p className="eyebrow">EDITABLE SETTINGS</p><h2 id="admin-settings-title">双平台独立设置</h2></div><button type="button" onClick={() => void save()} disabled={!settings || saveState === '保存中'}>{saveState || '保存设置'}</button></div>
        {settings ? <>
          <fieldset className="admin-bottom-settings admin-music"><legend>网易云音乐</legend>
            <label className="admin-check"><input type="checkbox" checked={settings.music.enabled}
              onChange={event => { setSettings({ ...settings, music: { ...settings.music, enabled: event.target.checked } }); setSaveState('') }} /><span>启用本地网易云连接</span></label>
            <label className="admin-field"><span>音乐桥接地址</span><input type="url" maxLength={256} value={settings.music.baseUrl}
              onChange={event => { setSettings({ ...settings, music: { ...settings.music, baseUrl: event.target.value } }); setSaveState('') }} /></label>
            <dl className="admin-music-status"><dt>播放状态</dt><dd>{musicStatusLabel(music)}</dd><dt>当前歌曲</dt><dd>{music.title || '—'}{music.artist && ` · ${music.artist}`}</dd><dt>歌词状态</dt><dd>{{ NONE: '暂无歌词', LOADING: '读取中', AVAILABLE: '已同步', UNAVAILABLE: '暂不可用' }[music.lyricsState]}</dd></dl>
            {settings.music.enabled && music.state === 'UNAVAILABLE' && <p className="admin-field-hint">{music.error === 'BAD_RESPONSE' ? '桥接返回的数据格式不兼容，请核对音乐桥接程序。' : '无法连接本地音乐桥接，请检查程序是否启动及地址是否正确。'}</p>}
            <div className="admin-music-controls">{([['prev', '上一首'], ['playpause', music.playing ? '暂停' : '播放'], ['next', '下一首']] as const).map(([action, label]) => (
              <button type="button" key={action} disabled={musicAction || music.state !== 'CONNECTED' || music.playbackState === 'CLIENT_CLOSED'} onClick={() => void controlMusic(action)}>{label}</button>
            ))}</div>
            {musicActionError && <p className="admin-error" role="alert">{musicActionError}</p>}
          </fieldset>
          <fieldset className="admin-bottom-settings"><legend>底部酒桌</legend>
            <label className="admin-field admin-task"><span>左桌 · 全局今日委托</span><input value={settings.global.task} maxLength={500} onChange={event => { setSettings({ ...settings, global: { ...settings.global, task: event.target.value } }); setSaveState('') }} /></label>
            <div className="admin-font-grid">{([['task', '今日委托字号'], ['bottomLabel', '底栏栏目名字号']] as const).map(([field, label]) => (
              <FontSizeControl key={field} name={field} label={label} value={settings.global.fontSizes[field]}
                onChange={size => { setSettings({ ...settings, global: { ...settings.global, fontSizes: { ...settings.global.fontSizes, [field]: size } } }); setSaveState('') }} />
            ))}</div>
            <div className="admin-platform-grid">{(['bilibili', 'douyin'] as Platform[]).map(platform => (
              <div className="admin-benefits-field" key={platform}>
                <label className="admin-field">
                  <span>{platformLabels[platform]}右桌 · 公告</span>
                  <textarea value={settings.platforms[platform].bottomAnnouncementText} maxLength={2501} rows={3}
                    onChange={event => { updatePlatform(platform, { bottomAnnouncementText: event.target.value }); setSaveState('') }} />
                </label>
                <FontSizeControl name="benefits" label={`${platformLabels[platform]}底部公告字号`} value={settings.platforms[platform].fontSizes.benefits}
                  onChange={size => updateFontSize(platform, 'benefits', size)} />
              </div>
            ))}</div>
            <p className="admin-field-hint">底部公告支持换行、Markdown 加粗和固定色板文字；直播页最多显示两行，超长省略。留空时只显示栏目名。</p>
          </fieldset>
          <div className="admin-platform-grid">{(['bilibili', 'douyin'] as Platform[]).map(platform => {
            const value = settings.platforms[platform]
            const interaction = status?.adapters[platform]
            return <fieldset key={platform}><legend>{platformLabels[platform]}专属页面</legend>
              {platform === 'bilibili' && <>
              <label className="admin-check"><input type="checkbox" checked={value.snifferEnabled || false} onChange={event => { updatePlatform(platform, {snifferEnabled: event.target.checked, boardMode: event.target.checked ? 'comments' : 'announcement'}); setSaveState('') }} /><span>启用{platformLabels[platform]}采集器接入</span></label>
              <label className="admin-field"><span>{platformLabels[platform]}主动推送地址</span><input readOnly value={`ws://${location.host}/ws/ingest/${platform}`} onFocus={event => event.target.select()} /></label>
              <p className="admin-field-hint">{adapterStateLabel(interaction?.state)} · 已收事件 {interaction?.eventCount ?? 0} 条{interaction?.lastEventAt && ` · 最近 ${new Date(interaction.lastEventAt).toLocaleTimeString('zh-CN')}`}</p>
              {!!interaction?.suppressedReplays && <p className="admin-field-hint">已过滤旧消息重放 {interaction.suppressedReplays} 条</p>}
              {interaction?.room && <p className="admin-field-hint">在线人数 {interaction.room.onlineCount ?? '—'} · 点赞 {interaction.room.likeCount ?? '—'}</p>}
              <label className="admin-field"><span>{platformLabels[platform]}直播间地址或房间号</span><input type="text" maxLength={256} value={value.roomAddress || ''} onChange={event => { updatePlatform(platform, { roomAddress: event.target.value }); setSaveState('') }} /></label>
              <label className="admin-field"><span>{platformLabels[platform]}采集 WebSocket 地址</span><input value={value.collector.url} maxLength={256} onChange={event => {updatePlatform(platform, {collector: {...value.collector, url: event.target.value}}); setSaveState('')}} /></label>
              <label className="admin-field"><span>{platformLabels[platform]}采集程序 exe 路径</span><input value={value.collector.executable} maxLength={1024} placeholder="已有采集服务运行时可留空" onChange={event => {updatePlatform(platform, {collector: {...value.collector, executable: event.target.value}}); setSaveState('')}} /></label>
              <label className="admin-check"><input type="checkbox" checked={value.collector.autoStart} onChange={event => {updatePlatform(platform, {snifferEnabled: event.target.checked || value.snifferEnabled, collector: {...value.collector, autoStart: event.target.checked}}); setSaveState('')}} /><span>随酒馆启动自动采集{platformLabels[platform]}</span></label>
              <div className="admin-music-controls">
                <button disabled={!!collectionAction || !value.snifferEnabled} onClick={() => void controlCollection(platform, 'start')}>一键开始{platformLabels[platform]}采集</button>
                <button disabled={!!collectionAction} onClick={() => void controlCollection(platform, 'stop')}>停止{platformLabels[platform]}采集</button>
              </div>
              {interaction?.error && <p className="admin-error" role="status">{interaction.error}</p>}
              <label className="admin-field"><span>{platformLabels[platform]}右栏显示</span><select value={value.boardMode || 'announcement'} onChange={event => { updatePlatform(platform, { boardMode: event.target.value as BoardMode }); setSaveState('') }}><option value="comments">直播留言</option><option value="announcement">酒馆公告</option></select></label>
              </>}
              <label className="admin-field"><span>右栏公告正文</span><textarea value={value.announcementText} maxLength={2000} rows={5} onChange={event => { updatePlatform(platform, { announcementText: event.target.value }); setSaveState('') }} /></label>
              <FontSizeControl name="announcement" label={`${platformLabels[platform]}公告字号`} value={value.fontSizes.announcement}
                onChange={size => updateFontSize(platform, 'announcement', size)} />
              <p className="admin-field-hint">{platform === 'bilibili' ? '采集器断开时显示此公告，连接恢复后按右栏设置显示。' : '抖音直播页显示此公告。'}</p>
              <label className="admin-check"><input type="checkbox" checked={value.lyricsEnabled} onChange={event => { updatePlatform(platform, { lyricsEnabled: event.target.checked }); setSaveState('') }} /><span>显示歌词</span></label>
              <label className="admin-check"><input type="checkbox" checked={value.lyricsAutoHide} onChange={event => { updatePlatform(platform, { lyricsAutoHide: event.target.checked }); setSaveState('') }} /><span>暂停或未连接时自动隐藏播放组件</span></label>
              <div className="admin-font-grid">{([['comments', '评论文字字号'], ['song', '歌曲信息字号'], ['lyrics', '歌词字号']] as const).map(([field, label]) => (
                <FontSizeControl key={field} name={field} label={`${platformLabels[platform]}${label}`} value={value.fontSizes[field]}
                  onChange={size => updateFontSize(platform, field, size)} />
              ))}</div>
            </fieldset>
          })}</div>
        </> : <p>正在读取可编辑配置。</p>}
      </section>

      <section className="admin-links" aria-label="页面入口"><h2>页面入口</h2><a href={status?.pages.bilibili || '/live/bilibili'} target="_blank" rel="noreferrer">B 站透明直播页 ↗</a><a href={status?.pages.douyin || '/live/douyin'} target="_blank" rel="noreferrer">抖音透明直播页 ↗</a><a href="/preview">布局线框预览 ↗</a><a href="/scene/review">CP3 场景验收 ↗</a></section>
    </main>
  )
}
