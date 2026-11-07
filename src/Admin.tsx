import { useEffect, useState } from 'react'

interface RuntimeStatus {
  service: string
  state: string
  version: string
  checkpoint: string
  startedAt: string
  port: number
  pages: Record<'bilibili' | 'douyin' | 'admin', string>
  websocket: { state: string; clients: number }
  adapters: { music: { state: string }; bilibili: { state: string } }
  configuration: { title: string; schemaVersion: number }
}

export function Admin() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null)
  const [connection, setConnection] = useState('CONNECTING')
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false
    let socket: WebSocket | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()

    async function readRuntime() {
      try {
        const response = await fetch('/api/runtime/status', { signal: controller.signal })
        if (!response.ok) throw new Error('服务状态读取失败')
        const data = await response.json()
        if (data.service !== 'lingxun-tavern') throw new Error('当前地址尚未运行统一服务')
        if (!disposed) {
          setStatus(data)
          setError('')
        }
      } catch {
        if (!disposed) {
          setStatus(null)
          setError('本地服务暂时不可达，正在等待重新连接。可通过启动入口检查服务。')
        }
      }
    }
    void readRuntime()

    function connect() {
      if (disposed) return
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`)
      socket.onopen = () => { if (!disposed) setConnection('CONNECTED') }
      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data)
          if (!disposed && message.type === 'runtime.status' && message.data?.service === 'lingxun-tavern') {
            setStatus(message.data)
            setError('')
          }
        } catch { /* A later valid status snapshot can restore the view. */ }
      }
      socket.onclose = () => {
        if (disposed) return
        setConnection('DISCONNECTED')
        void readRuntime()
        retry = setTimeout(connect, 2000)
      }
      socket.onerror = () => { if (!disposed) setConnection('DISCONNECTED') }
    }
    connect()
    return () => {
      disposed = true
      controller.abort()
      clearTimeout(retry)
      socket?.close()
    }
  }, [])

  const startTime = status ? new Date(status.startedAt).toLocaleString('zh-CN') : '等待服务响应'
  const displayState = error ? 'ERROR' : connection === 'DISCONNECTED' && status ? 'DEGRADED' : status?.state || 'CONNECTING'

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">SYSTEM / LOCAL RUNTIME</p>
          <h1>凌巽的酒馆 · 系统状态</h1>
        </div>
        <span className="admin-state">{displayState}</span>
      </header>
      <p className="admin-intro">这里显示本地服务的实际运行信息。直播控制与设置编辑安排在后续检查点。</p>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <section className="admin-grid" aria-label="本地系统状态">
        <div>
          <h2>本地服务</h2>
          <dl>
            <dt>服务状态</dt><dd>{status?.state || '等待响应'}</dd>
            <dt>版本</dt><dd>{status?.version || '—'}</dd>
            <dt>监听端口</dt><dd>{status?.port || '—'}</dd>
            <dt>启动时间</dt><dd>{startTime}</dd>
          </dl>
        </div>
        <div>
          <h2>状态连接</h2>
          <dl>
            <dt>WebSocket 服务</dt><dd>{status?.websocket.state || '等待响应'}</dd>
            <dt>当前页面连接</dt><dd>{connection}</dd>
            <dt>连接数量</dt><dd>{status?.websocket.clients ?? '—'}</dd>
            <dt>当前阶段</dt><dd>{status?.checkpoint || '等待响应'}</dd>
          </dl>
        </div>
        <div>
          <h2>外部适配器</h2>
          <dl>
            <dt>网易云</dt><dd>{status?.adapters.music.state || '等待响应'}</dd>
            <dt>B 站互动</dt><dd>{status?.adapters.bilibili.state || '等待响应'}</dd>
          </dl>
          <p>真实接入分别安排在 CP6 与 CP7。</p>
        </div>
        <div>
          <h2>本地配置</h2>
          <dl>
            <dt>配置标题</dt><dd>{status?.configuration.title || '等待响应'}</dd>
            <dt>配置版本</dt><dd>{status?.configuration.schemaVersion ?? '—'}</dd>
          </dl>
          <p>设置文件位于 data/settings.json，运行日志位于 data/logs/。</p>
        </div>
      </section>
      <section className="admin-links" aria-label="页面入口">
        <h2>页面入口</h2>
        <a href={status?.pages.bilibili || '/live/bilibili'} target="_blank" rel="noreferrer">B 站透明测试页 ↗</a>
        <a href={status?.pages.douyin || '/live/douyin'} target="_blank" rel="noreferrer">抖音透明测试页 ↗</a>
        <a href="/preview">布局线框预览 ↗</a>
      </section>
    </main>
  )
}
