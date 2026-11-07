import { useState } from 'react'
import manifest from '../assets/manifest.json'
import './asset-review.css'

const samples = [
  { name: '酒杯', detail: '木质杯身 · 深蓝金属箍 · 奶油色泡沫', image: new URL('../assets/generated/cp2/tavern-mug.png', import.meta.url).href },
  { name: '木桌', detail: '三块桌板 · 木质支撑 · 左上方高光', image: new URL('../assets/generated/cp2/wooden-table.png', import.meta.url).href },
  { name: '蜡烛', detail: '奶油色蜡身 · 暖金火焰 · 深蓝烛托', image: new URL('../assets/generated/cp2/candle.png', import.meta.url).href },
]

export function AssetReview() {
  const [background, setBackground] = useState('checker')

  return (
    <main className="asset-review">
      <div className="asset-review-inner">
        <header className="asset-review-header">
          <a href="/preview">凌巽的酒馆</a>
          <span>CP2 · 等待美术验收</span>
        </header>
        <section className="asset-intro">
          <p className="asset-eyebrow">CHECKPOINT 02 / PIXEL PROPS</p>
          <h1>酒馆道具，第一组样板。</h1>
          <p>逐件检查轮廓、配色、视角与质感。每件采用 64 × 64 逻辑画布，在这里以 4 倍整数放大展示。</p>
        </section>

        <div className="asset-toolbar">
          <span>透明边缘检查</span>
          <div role="group" aria-label="素材预览底色">
            <button aria-pressed={background === 'checker'} onClick={() => setBackground('checker')}>棋盘</button>
            <button aria-pressed={background === 'night'} onClick={() => setBackground('night')}>深蓝</button>
            <button aria-pressed={background === 'cream'} onClick={() => setBackground('cream')}>浅色</button>
          </div>
          <small>PNG 透明底 · 最近邻显示</small>
        </div>

        <section className="asset-samples" aria-label="三个独立透明像素素材">
          {samples.map((sample, index) => (
            <article className="asset-sample" key={sample.name}>
              <div className={`asset-stage asset-stage-${background}`}>
                <img className="asset-enlarged" src={sample.image} alt={`${sample.name}像素素材，四倍放大`} width="256" height="256" />
                <span className="asset-scale">4×</span>
              </div>
              <div className="asset-caption">
                <span className="asset-number">0{index + 1}</span>
                <h2>{sample.name}</h2>
                <span className="asset-pending">待验收</span>
              </div>
              <p className="asset-description">{sample.detail}</p>
              <div className="asset-original">
                <img src={sample.image} alt={`${sample.name}原尺寸`} width="64" height="64" />
                <span>1× 原尺寸<br />64 × 64 px</span>
                <a href={sample.image} download={`${manifest.assets[index].id}.png`}>下载 PNG ↗</a>
              </div>
            </article>
          ))}
        </section>

        <section className="asset-palette" aria-label="V2 固定色板">
          <div><h2>V2 固定色板</h2><p>深蓝轮廓，木棕结构，暖金与奶油白高光。</p></div>
          <ul>{manifest.palette.map(color => <li key={color}><span style={{ backgroundColor: color }} /><code>{color}</code></li>)}</ul>
        </section>
        <footer className="asset-review-footer">
          <p>内置生图制作独立源稿，离线统一为 64 × 64、V2 十色和硬透明边缘。三件的造型与风格等待你确认。</p>
          <a href="/preview">查看已通过的布局 ↗</a>
        </footer>
      </div>
    </main>
  )
}
