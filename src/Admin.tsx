import { useEffect, useState } from 'react'
import { benefitsTitles, type BoardMode, type Platform, type GlobalFontSizes, type PlatformFontSizes } from './Overlay'
import fontSizeLimits from '../config/font-sizes.json'

interface RuntimeStatus {
  service: string
  state: string
  version: string
  checkpoint: string
  startedAt: string
  port: number
  pages: Record<'bilibili' | 'douyin' | 'admin', string>
  websocket: { state: string; clients: number }
  adapters: Record<string, { state: string }>
  configuration: { title: string; task: string; schemaVersion: number }
}

interface EditableSettings {
  global: { task: string; fontSizes: GlobalFontSizes }
  platforms: Record<Platform, { boardMode: BoardMode; announcementText: string; lyricsEnabled: boolean; benefitsText: string; fontSizes: PlatformFontSizes }>
}

const platformLabels: Record<Platform, string> = { bilibili: 'B 站', douyin: '抖音' }

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
          if (message.type === 'runtime.status' && message.data?.service === 'lingxun-tavern') {
            setStatus(message.data)
            setError('')
          }
          if (message.type === 'settings.updated' && message.data?.global && message.data?.platformSettings) {
            setSettings(current => current ? {
              global: message.data.global,
              platforms: { ...current.platforms, [message.data.platform]: message.data.platformSettings },
            } : current)
          }
        } catch { /* Keep the last valid snapshot. */ }
      }
      socket.onclose = () => {
        if (disposed) return
        setConnection('DISCONNECTED')
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
    } catch (saveError) {
      setSaveState('')
      setError(saveError instanceof Error ? saveError.message : '配置保存失败')
    }
  }

  const startTime = status ? new Date(status.startedAt).toLocaleString('zh-CN') : '等待服务响应'
  const displayState = error && !settings ? 'ERROR' : connection === 'DISCONNECTED' && status ? 'DEGRADED' : status?.state || 'CONNECTING'

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p className="eyebrow">SYSTEM / CP5 CONTROL</p><h1>凌巽的酒馆 · 管理后台</h1></div>
        <span className="admin-state">{displayState}</span>
      </header>
      <p className="admin-intro">这里显示本地服务的实际状态，管理底部酒桌与两个平台各自的右栏设置。</p>
      {error && <p className="admin-error" role="alert">{error}</p>}

      <section className="admin-grid" aria-label="本地系统状态">
        <div><h2>本地服务</h2><dl><dt>服务状态</dt><dd>{status?.state || '等待响应'}</dd><dt>版本</dt><dd>{status?.version || '—'}</dd><dt>监听端口</dt><dd>{status?.port || '—'}</dd><dt>启动时间</dt><dd>{startTime}</dd></dl></div>
        <div><h2>状态连接</h2><dl><dt>WebSocket 服务</dt><dd>{status?.websocket.state || '等待响应'}</dd><dt>当前页面连接</dt><dd>{connection}</dd><dt>连接数量</dt><dd>{status?.websocket.clients ?? '—'}</dd><dt>当前阶段</dt><dd>{status?.checkpoint || '等待响应'}</dd></dl></div>
        <div><h2>外部适配器</h2><dl><dt>网易云</dt><dd>{status?.adapters.music?.state || '等待响应'}</dd><dt>B 站互动</dt><dd>{status?.adapters.bilibili?.state || '等待响应'}</dd><dt>抖音互动</dt><dd>{status?.adapters.douyin?.state || '未接入'}</dd></dl><p>真实音乐与平台互动分别安排在 CP6 与 CP7。</p></div>
        <div><h2>本地配置</h2><dl><dt>配置标题</dt><dd>{status?.configuration.title || '等待响应'}</dd><dt>今日委托</dt><dd>{status?.configuration.task || '等待响应'}</dd><dt>配置版本</dt><dd>{status?.configuration.schemaVersion ?? '—'}</dd></dl><p>普通设置保存到 data/settings.json，旧版本保存在 data/backups/。</p></div>
      </section>

      <section className="admin-settings" aria-labelledby="admin-settings-title">
        <div className="admin-settings-heading"><div><p className="eyebrow">EDITABLE SETTINGS</p><h2 id="admin-settings-title">双平台独立设置</h2></div><button type="button" onClick={() => void save()} disabled={!settings || saveState === '保存中'}>{saveState || '保存设置'}</button></div>
        {settings ? <>
          <fieldset className="admin-bottom-settings"><legend>底部酒桌</legend>
            <label className="admin-field admin-task"><span>左桌 · 全局今日委托</span><input value={settings.global.task} maxLength={500} onChange={event => { setSettings({ ...settings, global: { ...settings.global, task: event.target.value } }); setSaveState('') }} /></label>
            <div className="admin-font-grid">{([['task', '今日委托字号'], ['bottomLabel', '底栏栏目名字号']] as const).map(([field, label]) => (
              <FontSizeControl key={field} name={field} label={label} value={settings.global.fontSizes[field]}
                onChange={size => { setSettings({ ...settings, global: { ...settings.global, fontSizes: { ...settings.global.fontSizes, [field]: size } } }); setSaveState('') }} />
            ))}</div>
            <div className="admin-platform-grid">{(['bilibili', 'douyin'] as Platform[]).map(platform => (
              <div className="admin-benefits-field" key={platform}>
                <label className="admin-field">
                  <span>{platformLabels[platform]}右桌 · {benefitsTitles[platform]}</span>
                  <textarea value={settings.platforms[platform].benefitsText} maxLength={500} rows={3}
                    onChange={event => { updatePlatform(platform, { benefitsText: event.target.value }); setSaveState('') }} />
                </label>
                <FontSizeControl name="benefits" label={`${platformLabels[platform]}福利字号`} value={settings.platforms[platform].fontSizes.benefits}
                  onChange={size => updateFontSize(platform, 'benefits', size)} />
              </div>
            ))}</div>
            <p className="admin-field-hint">福利正文在直播页最多显示两行，支持换行，超长省略。留空时只显示栏目名。</p>
          </fieldset>
          <div className="admin-platform-grid">{(['bilibili', 'douyin'] as Platform[]).map(platform => {
            const value = settings.platforms[platform]
            return <fieldset key={platform}><legend>{platformLabels[platform]}专属页面</legend>
              <label className="admin-field"><span>右栏组件</span><select value={value.boardMode} onChange={event => { updatePlatform(platform, { boardMode: event.target.value as BoardMode }); setSaveState('') }}><option value="comments">留言板</option><option value="announcement">直播间公告</option></select></label>
              <label className="admin-field"><span>公告正文</span><textarea value={value.announcementText} maxLength={2000} rows={4} onChange={event => { updatePlatform(platform, { announcementText: event.target.value }); setSaveState('') }} /></label>
              <label className="admin-check"><input type="checkbox" checked={value.lyricsEnabled} onChange={event => { updatePlatform(platform, { lyricsEnabled: event.target.checked }); setSaveState('') }} /><span>显示歌词</span></label>
              <div className="admin-font-grid">{([['comments', '评论文字字号'], ['announcement', '公告正文字号'], ['song', '歌曲信息字号'], ['lyrics', '歌词字号']] as const).map(([field, label]) => (
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
