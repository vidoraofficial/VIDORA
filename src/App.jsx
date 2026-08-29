import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  AudioLines,
  Bolt,
  Check,
  ChevronRight,
  CircleCheck,
  ClipboardPaste,
  Download,
  Files,
  FolderOpen,
  Grid2X2,
  History,
  Home,
  Link2,
  Monitor,
  Moon,
  Music2,
  Network,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react'

const API_BASE_URL = 'http://127.0.0.1:8000'
const HISTORY_KEY = 'vidora-history'
const DOWNLOAD_PATH_KEY = 'vidora-download-path'
const THEME_KEY = 'vidora-theme'
const FALLBACK_APP_VERSION = '1.0.3'
const APP_VERSION = FALLBACK_APP_VERSION
const LICENSE_API_URL = 'https://vidora-license-api.areeshmustafa100.workers.dev'
const LICENSE_KEY_STORAGE = 'vidora-license-key'
const LICENSE_META_STORAGE = 'vidora-license-meta'
const MACHINE_ID_STORAGE = 'vidora-machine-id'

const navItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'downloader', label: 'Downloader', icon: Download },
  { id: 'bulk', label: 'Bulk', icon: Grid2X2 },
  { id: 'downloads', label: 'Downloads', icon: Files },
  { id: 'history', label: 'History', icon: History },
]

const showcaseItems = [
  { id: 'video', label: 'VIDEO', title: 'HD downloads', subtitle: 'Choose the quality you want.', accent: '#22d3ee' },
  { id: 'music', label: 'AUDIO', title: 'Clean audio', subtitle: 'Extract audio without the clutter.', accent: '#8b5cf6' },
  { id: 'bulk', label: 'BULK', title: 'Batch processing', subtitle: 'Queue multiple links at once.', accent: '#22c55e' },
  { id: 'quality', label: 'QUALITY', title: 'Pick your format', subtitle: 'Simple choices. No clutter.', accent: '#f59e0b' },
  { id: 'desktop', label: 'DESKTOP', title: 'Windows focused', subtitle: 'A polished local workspace.', accent: '#06b6d4' },
]

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function makeJobId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return 'Unknown'
  const total = Math.max(0, Math.floor(Number(seconds)))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function getVideoFormats(formats = []) {
  const grouped = new Map()
  for (const format of formats) {
    if (format.type !== 'video') continue
    let height = format.height
    if (!height && format.resolution) {
      const match = String(format.resolution).match(/(\d+)\s*x\s*(\d+)/)
      if (match) height = Number(match[2])
    }
    if (!height) continue
    const existing = grouped.get(height)
    if (!existing || (format.extension === 'mp4' && existing.extension !== 'mp4')) grouped.set(height, format)
  }
  return [...grouped.entries()].sort((a, b) => b[0] - a[0]).map(([height, format]) => ({
    formatId: format.format_id,
    height,
    extension: format.extension || 'mp4',
  }))
}

function getAudioFormats(formats = []) {
  const grouped = new Map()
  for (const format of formats) {
    if (format.type !== 'audio' || !format.abr) continue
    const key = `${Math.round(format.abr)}-${format.extension}`
    if (!grouped.has(key)) grouped.set(key, format)
  }
  return [...grouped.values()].sort((a, b) => b.abr !== a.abr ? b.abr - a.abr : String(a.extension).localeCompare(String(b.extension))).map((format) => ({
    formatId: format.format_id,
    bitrate: Math.round(format.abr),
    extension: format.extension,
  }))
}

const Icon = memo(function Icon({ icon: Component, size = 18, className = '', strokeWidth = 1.8 }) {
  return <Component size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />
})

import VIDORA_LOGO_SRC from './assets/vidora-logo.png'

function VidoraLogo({ size = 38, className = '' }) {
  return <img src={VIDORA_LOGO_SRC} alt="VIDORA" width={size} height={size} className={`object-contain ${className}`} draggable="false" />
}



function PremiumNavIcon({ icon: Component, dark, active }) {
  return <span className={`nav-icon-pack ${dark ? 'nav-icon-pack-dark' : 'nav-icon-pack-light'} ${active ? 'nav-icon-pack-active' : ''}`}><span className="nav-icon-pack-glow"/><span className="nav-icon-pack-core"><Component size={17} strokeWidth={1.85} /></span></span>
}

function NebulaPrimaryButton({ children, onClick, icon: Component = ArrowRight, disabled = false, className = '', type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`codepen-action-button codepen-action-dark ${className}`}>
      <span className="codepen-action-inner"><span>{children}</span><Component size={17} strokeWidth={1.7} className="codepen-action-icon" /></span>
    </button>
  )
}

function NebulaSecondaryButton({ children, onClick, icon: Component = ArrowRight, disabled = false, className = '', type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`secondary-button secondary-button-dark ${className}`}>
      <span>{children}</span><Component size={16} strokeWidth={1.8} className="secondary-button-icon" />
    </button>
  )
}

function OrionPrimaryButton({ children, onClick, disabled = false, className = '', type = 'button' }) {
  return (
    <div className={`orion-glass-button-wrap ${className}`} style={{ animation: 'vidoraGlassFadeIn 1s ease-out 0.3s both' }}>
      <button type={type} onClick={onClick} disabled={disabled} className="orion-glass-button">
        <span className="orion-glass-button-text">{children}</span>
        <div className="orion-glass-button-shine" />
      </button>
    </div>
  )
}

function OrionSecondaryButton({ children, onClick, icon: Component = ArrowRight, disabled = false, className = '', type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`secondary-button secondary-button-light ${className}`}>
      <span>{children}</span><Component size={16} strokeWidth={1.8} className="secondary-button-icon" />
    </button>
  )
}

function Button({ dark, children, onClick, icon, disabled = false, className = '', variant = 'primary', type = 'button' }) {
  if (dark) return variant === 'secondary'
    ? <NebulaSecondaryButton type={type} onClick={onClick} icon={icon} disabled={disabled} className={className}>{children}</NebulaSecondaryButton>
    : <NebulaPrimaryButton type={type} onClick={onClick} icon={icon} disabled={disabled} className={className}>{children}</NebulaPrimaryButton>
  return variant === 'secondary'
    ? <OrionSecondaryButton type={type} onClick={onClick} icon={icon} disabled={disabled} className={className}>{children}</OrionSecondaryButton>
    : <OrionPrimaryButton type={type} onClick={onClick} icon={icon} disabled={disabled} className={className}>{children}</OrionPrimaryButton>
}

const Glass = memo(function Glass({ dark, children, className = '', hover = true }) {
  return <div className={[dark ? 'nebula-card nebula-gradient-border' : 'orion-glass-panel', hover ? 'surface-hover' : '', className].join(' ')}>{children}</div>
})

function Status({ children, tone = 'neutral', dark }) {
  const map = dark ? {
    neutral: 'border-white/10 bg-white/[.04] text-slate-500', blue: 'border-cyan-400/15 bg-cyan-400/[.05] text-cyan-300', green: 'border-emerald-400/15 bg-emerald-400/[.05] text-emerald-300', red: 'border-rose-400/15 bg-rose-400/[.05] text-rose-300', amber: 'border-amber-400/15 bg-amber-400/[.05] text-amber-300',
  } : {
    neutral: 'border-slate-200/80 bg-white/70 text-slate-500', blue: 'border-blue-200/80 bg-blue-50/80 text-blue-600', green: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-600', red: 'border-rose-200/80 bg-rose-50/80 text-rose-600', amber: 'border-amber-200/80 bg-amber-50/80 text-amber-600',
  }
  const dot = tone === 'green' ? 'bg-emerald-400' : tone === 'red' ? 'bg-rose-400' : tone === 'blue' ? 'bg-blue-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-slate-400'
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.16em] ${map[tone]}`}><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{children}</span>
}

function YouTubeLogo() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z"/><path d="m9.7 15.7 6.1-3.7-6.1-3.7v7.4Z" fill="#fff"/></svg> }
function InstagramLogo() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="17.3" cy="6.8" r="1" fill="currentColor"/></svg> }
function TikTokLogo() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.4 3c.3 2.4 1.6 3.9 4 4.3v3.1c-1.6.1-3.1-.4-4.2-1.2v6.3a5.8 5.8 0 1 1-5-5.7v3.2a2.7 2.7 0 1 0 1.9 2.5V3h3.3Z"/></svg> }
function FacebookLogo() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 8h3V4h-3c-3.2 0-5 1.9-5 5v2H6v4h3v5h4v-5h3l1-4h-4V9c0-.7.3-1 1-1Z"/></svg> }
function RedditLogo() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><path d="M8.2 15c1 .8 2.2 1.2 3.8 1.2s2.8-.4 3.8-1.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> }
function XLogo() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h3.5l4.1 5.6L16.4 4H20l-6.7 7.5L20.5 20H17l-4.6-6.1L7.7 20H4l6.8-7.8L4 4Z"/></svg> }
function VimeoLogo() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.4 6.1c-.2 2.8-2.2 6.7-6 11.3-4 4.8-7.1 7.2-9.7 7.2-1.6 0-3-1.5-4.2-4.5C.7 17.1-.1 14.1-.9 11.1c-.7-2.6.9-4.3 2.3-4.8 1.5-.5 2.9.2 4 2.1.7 1.2 1.3 4.4 2 9.6.7 3.9 1.4 5.8 2.2 5.8.9 0 2.3-1.4 4.3-4.4 1.9-3 3-5.2 3.2-6.5.3-2.4-.7-3.5-2.6-3.5-.9 0-1.8.3-2.7.9 1.8-5.7 5.2-8.4 10.3-8.3.3 0 .9.1 1.8.5Z"/></svg> }

function ShowcaseVisual({ item, dark }) {
  const bg = {
    video: dark ? 'linear-gradient(135deg,#07131d,#0b2638 45%,#102f42)' : 'linear-gradient(135deg,#eef7ff,#ffffff 48%,#e8f2ff)',
    music: dark ? 'linear-gradient(135deg,#110b1f,#24103d 50%,#31164c)' : 'linear-gradient(135deg,#f5f1ff,#fbfaff 50%,#efe8ff)',
    bulk: dark ? 'linear-gradient(135deg,#07160d,#0b3020 50%,#0e3a27)' : 'linear-gradient(135deg,#eefcf5,#fbfffd 50%,#e8f8ef)',
    quality: dark ? 'linear-gradient(135deg,#191007,#36200a 50%,#472b0d)' : 'linear-gradient(135deg,#fff7ea,#fffdf8 50%,#fff1d5)',
    desktop: dark ? 'linear-gradient(135deg,#061418,#092b30 50%,#0d373c)' : 'linear-gradient(135deg,#edfafa,#fbffff 50%,#e7f5f6)',
  }[item.id]
  if (item.id === 'video') return <div className="relative h-full w-full overflow-hidden" style={{ background: bg }}><div className="absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl" style={{ background: item.accent, opacity: dark ? .2 : .1 }} /><div className={`absolute inset-8 rounded-2xl border grid place-items-center backdrop-blur-md ${dark ? 'border-white/10 bg-black/20' : 'border-white/80 bg-white/35'}`}><div className={`relative h-24 w-40 rounded-xl border ${dark ? 'border-white/10 bg-white/[.04]' : 'border-white/80 bg-white/65'}`}><div className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-lg" style={{ background: item.accent, color: dark ? '#07131d' : '#fff' }}><Play size={17} fill="currentColor" /></div></div></div></div>
  if (item.id === 'music') return <div className="relative h-full w-full overflow-hidden p-7" style={{ background: bg }}><div className="absolute inset-x-5 bottom-0 flex h-44 items-end justify-center gap-1.5 opacity-70">{Array.from({ length: 28 }, (_, i) => <div key={i} className="w-[3px] rounded-full" style={{ height: `${18 + ((i * 17) % 92)}px`, background: item.accent, opacity: .2 + (i % 5) * .07 }} />)}</div><div className="relative z-10 flex justify-between"><div className={`grid h-12 w-12 place-items-center rounded-2xl border ${dark ? 'border-white/10 bg-white/[.05] text-white' : 'border-white/80 bg-white/65 text-slate-600'}`}><Music2 size={21} /></div><div className={`rounded-full border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.16em] ${dark ? 'border-white/10 bg-white/[.05] text-white/60' : 'border-white/80 bg-white/70 text-slate-500'}`}>AUDIO</div></div></div>
  if (item.id === 'bulk') return <div className="relative h-full w-full overflow-hidden p-7" style={{ background: bg }}><div className="grid h-full grid-cols-2 gap-3">{['01','02','03','04'].map((n,i)=><div key={n} className={`flex items-center justify-between rounded-2xl border px-4 ${dark ? 'border-white/10 bg-white/[.04]' : 'border-white/80 bg-white/55'}`} style={{ animation: `showcasePulse 2.8s ease-in-out ${i * .2}s infinite` }}><span className={dark ? 'text-[10px] text-white/45' : 'text-[10px] text-slate-400'}>VIDEO</span><span className="text-sm font-bold" style={{ color: item.accent }}>{n}</span></div>)}</div></div>
  if (item.id === 'quality') return <div className="relative h-full w-full overflow-hidden p-7" style={{ background: bg }}><div className="flex h-full flex-col justify-center gap-2.5">{['2160p','1440p','1080p','720p'].map((q,i)=><div key={q} className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${dark ? 'border-white/10 bg-black/10' : 'border-white/75 bg-white/60'}`}><span className={dark ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-slate-700'}>{q}</span><span className="h-2.5 w-2.5 rounded-full" style={{ background: i === 2 ? item.accent : dark ? 'rgba(255,255,255,.18)' : 'rgba(100,116,139,.25)', boxShadow: i === 2 ? `0 0 12px ${item.accent}` : 'none' }} /></div>)}</div></div>
  return <div className="relative h-full w-full overflow-hidden" style={{ background: bg }}><div className="grid h-full place-items-center"><div className="relative"><div className="absolute -inset-14 rounded-full blur-3xl" style={{ background: item.accent, opacity: dark ? .14 : .08 }} /><div className={`relative grid h-28 w-28 place-items-center rounded-[28px] border shadow-xl ${dark ? 'border-white/10 bg-white/[.04] text-white/80' : 'border-white/80 bg-white/65 text-slate-500'}`}><Monitor size={42} strokeWidth={1.5} /></div></div></div></div>
}

function LightHeroVisual() {
  return <div className="orion-hero-visual"><div className="orion-hero-glow"/><div className="orion-device"><div className="orion-device-side orion-device-button-a"/><div className="orion-device-side orion-device-button-b"/><div className="orion-device-side orion-device-button-c"/><div className="orion-device-right"/><div className="orion-device-body"><div className="orion-device-screen"><div className="orion-dynamic-island"><span/><i/></div><div className="orion-status-bar"><span>9:41</span><div><Activity size={12}/><Network size={12}/><div className="orion-battery"><span/></div></div></div><div className="orion-screen-content"><div className="orion-screen-heading"><strong>Intelligence</strong><span>All systems operational</span></div><div className="orion-mini-card orion-uptime-card"><div><span className="orion-mini-label">GLOBAL UPTIME</span><strong>99.9<span>%</span></strong></div><div className="orion-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8"/><circle cx="50" cy="50" r="42" fill="none" stroke="#3b82f6" strokeWidth="8" strokeDasharray="264" strokeDashoffset="26.4" strokeLinecap="round"/></svg><div><Check size={14}/></div></div></div><div className="orion-mini-card orion-chart-card"><div className="orion-mini-card-top"><div className="orion-response-heading"><i/><span>RESPONSE</span></div><div className="orion-response-value">182<span>ms</span></div></div><div className="orion-bars">{[30,45,35,55,75,100,65,45,25,40,50,35].map((h,i)=><span key={i} style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}/>)}</div></div><div className="orion-mini-card orion-action-card"><div className="orion-action-icon"><Bolt size={14}/></div><div><strong>Auto-Remediation</strong><span>Active • 3 actions</span></div><div className="orion-toggle"><span/></div></div></div><div className="orion-home-indicator"/></div></div></div></div>
}

function HomePage({ dark, onStart }) {
  const cards = useMemo(() => [...showcaseItems, ...showcaseItems], [])
  const trustedSites = useMemo(() => [
    ['YouTube', YouTubeLogo], ['Instagram', InstagramLogo], ['TikTok', TikTokLogo], ['Facebook', FacebookLogo], ['Reddit', RedditLogo], ['X / Twitter', XLogo], ['Vimeo', VimeoLogo],
  ], [])
  const trustedRepeated = [...trustedSites, ...trustedSites]
  return <section className="space-y-20">
    <div className={dark ? 'nebula-hero nebula-gradient-border' : 'orion-hero'}>
      {dark && <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_16%,rgba(34,211,238,.12),transparent_30%),radial-gradient(circle_at_12%_88%,rgba(99,102,241,.09),transparent_34%)]"/>}
      {!dark && <div className="orion-hero-bg-shape"/>}
      <div className="relative z-10 grid min-h-[620px] items-center gap-8 px-7 py-14 sm:px-10 lg:grid-cols-[1fr_1fr] lg:px-16">
        <div className="animate-fadeSlideIn"><div className={dark ? 'theme-badge-dark' : 'theme-badge-light'}><Sparkles size={12} className="text-sky-400"/>VIDORA DESKTOP</div><h1 className={`mt-7 text-5xl font-semibold leading-[.95] tracking-[-.07em] sm:text-6xl lg:text-7xl ${dark ? 'text-white' : 'text-slate-900'}`}>Your media.<span className={dark ? 'block bg-gradient-to-r from-white via-cyan-200 to-blue-300 bg-clip-text text-transparent' : 'block bg-gradient-to-r from-slate-900 via-blue-700 to-slate-700 bg-clip-text text-transparent'}>Your way.</span></h1><p className={`mt-7 max-w-xl text-sm leading-7 sm:text-[15px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Download videos, extract audio, process multiple links and keep everything organized in one focused Windows workspace.</p><div className="mt-8 flex flex-wrap gap-3 animate-fadeSlideIn-delay-400"><Button dark={dark} onClick={onStart}>Start downloading</Button><Button dark={dark} onClick={onStart} icon={Download} variant="secondary">Explore Downloader</Button></div><div className="mt-9 grid max-w-xl grid-cols-3 gap-3">{[['01','Analyze'],['02','Choose'],['03','Download']].map(([n,t])=><div key={n} className={dark ? 'theme-step-dark' : 'theme-step-light'}><div className="theme-step-number">{n}</div><div className="theme-step-title">{t}</div></div>)}</div></div>
        {dark ? <div className="relative hidden min-h-[440px] lg:block animate-fadeSlideIn-delay-400"><div className="absolute left-1/2 top-1/2 h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-[105px]"/><div className="absolute left-[3%] top-[10%] h-[275px] w-[330px] rotate-[-7deg] rounded-[30px] border border-white/10 bg-zinc-900/55 shadow-2xl backdrop-blur-xl animate-float-a"><div className="absolute inset-4 grid place-items-center rounded-[22px] border border-white/10 bg-black/15"><div className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white"><Play size={20}/></div></div></div><div className="absolute right-0 top-[23%] h-[260px] w-[315px] rotate-[6deg] rounded-[30px] border border-white/10 bg-zinc-900/70 p-5 shadow-2xl backdrop-blur-xl animate-float-b"><div className="flex justify-between"><div><div className="text-[9px] uppercase tracking-[.18em] text-slate-600">QUALITY</div><div className="mt-1 text-lg font-medium text-zinc-100">Choose your format</div></div><div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[.05] text-cyan-300"><Sparkles size={15}/></div></div><div className="mt-6 space-y-2">{['1080p','720p','480p'].map((q,i)=><div key={q} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3"><span className="text-xs font-semibold text-zinc-200">{q}</span><span className={`h-2 w-2 rounded-full ${i === 0 ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,.6)]' : 'bg-slate-600'}`}/></div>)}</div></div></div> : <div className="hidden lg:block"><LightHeroVisual/></div>}
      </div>
    </div>

    <section><div className="mb-5 flex items-end justify-between gap-4"><div><div className={`text-[9px] font-semibold uppercase tracking-[.2em] ${dark ? 'text-slate-600' : 'text-slate-400'}`}>VIDORA SHOWCASE</div><div className={`mt-2 text-xl font-medium tracking-tight ${dark ? 'text-zinc-100' : 'text-slate-800'}`}>One workspace. Different kinds of media.</div></div><div className={`hidden rounded-full border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.14em] sm:block ${dark ? 'border-white/10 bg-white/[.04] text-slate-600' : 'border-white/75 bg-white/60 text-slate-400'}`}>Auto scrolling</div></div><div className="vidora-marquee"><div className="vidora-marquee-track">{cards.map((item,index)=><article key={`${item.id}-${index}`} className={`showcase-card ${dark ? 'showcase-card-dark nebula-gradient-border' : 'showcase-card-light'}`}><div className="h-[220px]"><ShowcaseVisual item={item} dark={dark}/></div><div className={`border-t px-5 py-5 ${dark ? 'border-white/10' : 'border-slate-200/60'}`}><div className="text-[9px] font-semibold uppercase tracking-[.18em]" style={{color:item.accent}}>{item.label}</div><div className={`mt-1.5 text-base font-medium ${dark ? 'text-zinc-100' : 'text-slate-800'}`}>{item.title}</div><div className={`mt-1.5 text-xs leading-5 ${dark ? 'text-zinc-500' : 'text-slate-500'}`}>{item.subtitle}</div></div></article>)}</div></div></section>

    <section className="overflow-hidden"><div className="mb-5"><div className={`text-[9px] font-semibold uppercase tracking-[.2em] ${dark ? 'text-slate-600' : 'text-slate-400'}`}>TRUSTED SITES</div><div className={`mt-2 text-xl font-medium tracking-tight ${dark ? 'text-zinc-100' : 'text-slate-800'}`}>Works with popular video platforms.</div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">VIDORA uses yt-dlp site support. Availability can change when a platform changes its systems.</p></div><div className={`trusted-sites-shell ${dark ? 'trusted-sites-dark' : 'trusted-sites-light'}`}><div className="trusted-sites-mask"><div className="trusted-sites-track">{trustedRepeated.map(([name,Logo],i)=><div key={`${name}-${i}`} className="trusted-site-card"><div className="trusted-site-icon"><Logo/></div><span>{name}</span></div>)}</div></div><div className="trusted-sites-glow trusted-sites-glow-left"/><div className="trusted-sites-glow trusted-sites-glow-right"/></div></section>

    <div className="grid gap-4 lg:grid-cols-4">{[{icon:Bolt,title:'Fast',text:'Analyze links and get directly to the media you want.'},{icon:Download,title:'Flexible',text:'Choose video quality, audio or MP3.'},{icon:Grid2X2,title:'Bulk',text:'Queue multiple links and process them together.'},{icon:FolderOpen,title:'Your folders',text:'Send finished files directly to your chosen folder.'}].map((feature)=><Glass key={feature.title} dark={dark} className="p-6"><div className={`grid h-11 w-11 place-items-center rounded-2xl border ${dark ? 'border-white/10 bg-white/[.04] text-cyan-300' : 'border-white/80 bg-white/65 text-slate-600'}`}><Icon icon={feature.icon} size={18}/></div><div className={`mt-6 text-sm font-semibold ${dark ? 'text-zinc-100' : 'text-slate-800'}`}>{feature.title}</div><div className={`mt-2 text-xs leading-5 ${dark ? 'text-zinc-500' : 'text-slate-500'}`}>{feature.text}</div></Glass>)}</div>

    <div className={`relative overflow-hidden rounded-[32px] border px-7 py-12 text-center ${dark ? 'nebula-card nebula-gradient-border' : 'orion-glass-panel'}`}><div className="orion-cta-glow"/><div className="relative"><div className={`text-[9px] font-semibold uppercase tracking-[.2em] ${dark ? 'text-slate-600' : 'text-slate-400'}`}>READY WHEN YOU ARE</div><div className={`mt-3 text-3xl font-medium tracking-[-.04em] ${dark ? 'text-zinc-100' : 'text-slate-800'}`}>Start with a link.</div><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">Analyze your URL, choose the quality, and let VIDORA handle the rest.</p><Button dark={dark} onClick={onStart} className="mt-6">Open Downloader</Button></div></div>
  </section>
}

function DownloaderPage({ dark, url, setUrl, videoInfo, videoFormats, audioFormats, isAnalyzing, error, setError, analyze, paste, download, cancelDownload, downloadState, qualityRef, downloadSectionRef, resetDownloader }) {
  const activeDownload = downloadState.status === 'downloading'
  const cancelling = downloadState.status === 'cancelling'
  return <section className="space-y-8 animate-fadeSlideIn"><div><div className={`text-[9px] font-semibold uppercase tracking-[.2em] ${dark ? 'text-cyan-400' : 'text-blue-600'}`}>DOWNLOADER</div><h1 className={`mt-4 text-4xl font-medium tracking-[-.05em] sm:text-5xl ${dark ? 'text-white' : 'text-slate-900'}`}>Start with a link.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">Analyze a supported URL, choose your format, then download.</p></div>
    <Glass dark={dark} hover={false} className="overflow-hidden"><div className={`border-b p-6 ${dark ? 'border-white/10' : 'border-slate-200/60'}`}><div className={`text-[9px] font-semibold uppercase tracking-[.18em] ${dark ? 'text-slate-600' : 'text-slate-400'}`}>VIDEO URL</div><div className="mt-3 flex flex-col gap-3 xl:flex-row"><div className="relative min-w-0 flex-1"><Link2 className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-600' : 'text-slate-400'}`} size={17}/><input disabled={activeDownload||cancelling} value={url} onChange={e=>{setUrl(e.target.value);setError('')}} onKeyDown={e=>{if(e.key==='Enter'&&!isAnalyzing&&!activeDownload&&!cancelling) analyze()}} placeholder="Paste video link..." className={`h-14 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none transition-all ${activeDownload||cancelling ? 'cursor-not-allowed opacity-60 ' : ''}${dark ? 'border-white/10 bg-black/20 text-white placeholder:text-slate-700 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10' : 'border-white/80 bg-white/60 text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100/60'}`}/></div><Button dark={dark} onClick={paste} disabled={activeDownload||cancelling} icon={ClipboardPaste} variant="secondary">Paste</Button><Button dark={dark} onClick={analyze} disabled={isAnalyzing||activeDownload||cancelling||!url.trim()}>{isAnalyzing?'Analyzing...':'Analyze link'}</Button>{videoInfo&&!activeDownload&&!cancelling&&<Button dark={dark} onClick={resetDownloader} icon={RefreshCw} variant="secondary">Refresh</Button>}</div>{error&&<div className={`mt-4 rounded-2xl border px-4 py-3 text-xs ${dark ? 'border-rose-400/15 bg-rose-400/[.05] text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-600'}`}>{error}</div>}</div>
      <div className="p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className={`text-[9px] font-semibold uppercase tracking-[.18em] ${dark ? 'text-slate-600' : 'text-slate-400'}`}>MEDIA</div><h2 className={`mt-2 break-words text-2xl font-medium ${dark ? 'text-zinc-100' : 'text-slate-800'}`}>{videoInfo?.title||'Analyze a link to see available formats'}</h2><p className="mt-2 text-xs text-slate-500">{videoInfo?`${videoInfo.uploader||'Unknown creator'} • ${formatDuration(videoInfo.duration)}`:'Formats and media information will appear here.'}</p></div><Status dark={dark} tone={videoInfo?'green':'neutral'}>{videoInfo?'Analyzed':'Waiting'}</Status></div>
        <div className="mt-7 grid gap-7 xl:grid-cols-[330px_1fr]"><div className={`aspect-video overflow-hidden rounded-[24px] border ${dark ? 'border-white/10 bg-black/20' : 'border-white/80 bg-white/35 shadow-soft-card'}`}>{videoInfo?.thumbnail?<img src={videoInfo.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover"/>:<div className={`grid h-full place-items-center text-[9px] font-semibold uppercase tracking-[.17em] ${dark?'text-slate-700':'text-slate-400'}`}>Preview</div>}</div><div ref={qualityRef}><div className={`text-[9px] font-semibold uppercase tracking-[.18em] ${dark ? 'text-slate-600' : 'text-slate-400'}`}>QUALITY</div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{videoFormats.length?videoFormats.map(f=><button key={f.formatId} type="button" onClick={()=>download(f.formatId,`${f.height}p`)} disabled={activeDownload||cancelling} className={`quality-tile ${dark?'quality-dark':'quality-light-orion'} ${activeDownload||cancelling?'cursor-not-allowed opacity-50':''}`}><div className="flex items-center justify-between"><span className="text-xl font-medium">{f.height}p</span><span className="grid h-8 w-8 place-items-center rounded-full border"><ArrowRight size={14}/></span></div><div className={`mt-5 text-[9px] uppercase tracking-[.16em] ${dark?'text-slate-600':'text-slate-400'}`}>{f.extension}</div></button>):[1080,720,480,360].map(q=><div key={q} className={`quality-tile opacity-40 ${dark?'quality-dark':'quality-light-orion'}`}><div className="text-xl font-medium">{q}p</div><div className="mt-5 text-[9px] uppercase tracking-[.16em]">Waiting</div></div>)}</div><div className="mt-8"><div className={`text-[9px] font-semibold uppercase tracking-[.18em] ${dark?'text-slate-600':'text-slate-400'}`}>AUDIO / MP3</div><div className="mt-3 space-y-2.5">{audioFormats.length?audioFormats.map(f=><div key={f.formatId} className={`flex flex-col gap-3 rounded-[22px] border p-4 sm:flex-row sm:items-center sm:justify-between ${dark?'border-white/10 bg-white/[.035]':'border-white/80 bg-white/55 shadow-soft-card'}`}><div><div className={`text-sm font-semibold ${dark?'text-zinc-100':'text-slate-800'}`}>{f.bitrate} kbps</div><div className="mt-1 text-[9px] uppercase tracking-[.14em] text-slate-400">{f.extension}</div></div><div className="flex gap-2"><Button dark={dark} onClick={()=>download(f.formatId,`${f.bitrate} kbps`)} disabled={activeDownload||cancelling} icon={AudioLines} variant="secondary">Audio</Button><Button dark={dark} onClick={()=>download(f.formatId,`${f.bitrate} kbps`,true)} disabled={activeDownload||cancelling} icon={Music2}>MP3</Button></div></div>):<div className={`rounded-[22px] border px-4 py-4 text-xs ${dark?'border-white/10 text-slate-600':'border-slate-200 bg-white/45 text-slate-400'}`}>Audio options appear after analysis.</div>}</div></div></div></div>
      </div>
    </Glass>
    <Glass dark={dark} hover={false} className="relative overflow-hidden"><div ref={downloadSectionRef} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${dark?'border-white/10 bg-white/[.04] text-cyan-300':'border-white/80 bg-white/60 text-slate-500'}`}><Icon icon={downloadState.status==='success'?CircleCheck:downloadState.status==='cancelled'?Check:Download} size={17}/></div><div className="min-w-0 flex-1"><div className="text-[9px] font-semibold uppercase tracking-[.16em] text-slate-400">DOWNLOAD STATUS</div><div className={`mt-1 text-sm font-medium ${dark?'text-zinc-100':'text-slate-800'}`}>{downloadState.status==='idle'?'Ready for your next download.':downloadState.message}</div>{downloadState.filename&&<div className="mt-1 truncate text-xs text-slate-400">{downloadState.filename}</div>}</div>{activeDownload&&<button type="button" onClick={cancelDownload} className={dark?'cancel-button cancel-dark':'cancel-button cancel-light'}><Square size={12} strokeWidth={2}/>Cancel download</button>}{cancelling&&<Status dark={dark} tone="amber">Cancelling</Status>}</div>{activeDownload&&<div className={`h-1 overflow-hidden ${dark?'bg-white/5':'bg-slate-200/50'}`}><div className="h-full w-1/3 animate-[vidoraProgress_1.4s_ease-in-out_infinite] bg-blue-500"/></div>}</Glass>
  </section>
}

function BulkPage({ dark, bulkText, setBulkText, bulkQuality, setBulkQuality, bulkState, startBulkDownload, cancelBulkDownload, bulkRef }) {
  const processing = bulkState.status === 'processing' || bulkState.status === 'cancelling'
  return <section className="space-y-8 animate-fadeSlideIn" ref={bulkRef}><div><div className={`text-[9px] font-semibold uppercase tracking-[.2em] ${dark?'text-cyan-400':'text-blue-600'}`}>BULK</div><h1 className={`mt-4 text-4xl font-medium tracking-[-.05em] sm:text-5xl ${dark?'text-white':'text-slate-900'}`}>Batch processing.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">Add up to 20 supported links and download them together.</p></div><Glass dark={dark} hover={false} className="overflow-hidden"><div className={`border-b px-6 py-4 ${dark?'border-white/10':'border-slate-200/60'}`}><div className="text-[9px] font-semibold uppercase tracking-[.18em] text-slate-400">INPUT LINKS</div></div><textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} disabled={processing} placeholder={'https://...\nhttps://...\nhttps://...'} className={`min-h-[300px] w-full resize-y border-0 p-6 text-sm leading-7 outline-none ${dark?'bg-black/10 text-white placeholder:text-slate-700':'bg-white/20 text-slate-700 placeholder:text-slate-400'}`}/><div className={`border-t p-6 ${dark?'border-white/10':'border-slate-200/60'}`}><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[9px] font-semibold uppercase tracking-[.18em] text-slate-400">QUALITY</div><select value={bulkQuality} onChange={e=>setBulkQuality(e.target.value)} disabled={processing} className={`mt-2 min-w-[210px] rounded-full border px-4 py-3 text-xs outline-none ${dark?'border-white/10 bg-black/20 text-white':'border-slate-200 bg-white/70 text-slate-700'}`} style={{colorScheme:dark?'dark':'light'}}><option value="best">Best available</option><option value="1080p">Up to 1080p</option><option value="720p">Up to 720p</option><option value="480p">Up to 480p</option><option value="360p">Up to 360p</option></select></div>{bulkState.status==='processing'?<button type="button" onClick={cancelBulkDownload} className={dark?'cancel-button cancel-dark':'cancel-button cancel-light'}><Square size={13}/>Cancel bulk download</button>:<Button dark={dark} disabled={processing} onClick={startBulkDownload}>Download all</Button>}</div>{bulkState.status!=='idle'&&<div className={`mt-6 border-t pt-6 ${dark?'border-white/10':'border-slate-200/60'}`}>{processing&&<div className={`mb-5 h-1 overflow-hidden rounded-full ${dark?'bg-white/5':'bg-slate-200/60'}`}><div className={`h-full rounded-full ${bulkState.status==='cancelling'?'w-full bg-amber-400':'w-1/3 animate-[vidoraProgress_1.4s_ease-in-out_infinite] bg-emerald-400'}`}/></div>}<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className={`text-sm font-medium ${dark?'text-zinc-100':'text-slate-800'}`}>{bulkState.message}</div><div className="flex flex-wrap gap-2"><Status dark={dark} tone="blue">Total {bulkState.total}</Status><Status dark={dark} tone="green">Done {bulkState.successful}</Status><Status dark={dark} tone="red">Failed {bulkState.failed}</Status></div></div>{bulkState.downloadUrl&&bulkState.status==='success'&&<Button dark={dark} className="mt-5" icon={Download} onClick={()=>window.open(bulkState.downloadUrl,'_blank','noopener,noreferrer')}>Download ZIP</Button>}</div>}</div></Glass></section>
}

function DownloadsPage({ dark, downloads }) { return <section className="space-y-8 animate-fadeSlideIn"><div><div className={`text-[9px] font-semibold uppercase tracking-[.2em] ${dark?'text-cyan-400':'text-blue-600'}`}>DOWNLOADS</div><h1 className={`mt-4 text-4xl font-medium tracking-[-.05em] sm:text-5xl ${dark?'text-white':'text-slate-900'}`}>Current downloads.</h1></div><div className="space-y-3">{downloads.length===0?<Glass dark={dark} hover={false} className="p-12 text-center"><Download size={22} className={dark?'text-slate-700':'text-slate-400'}/><div className={`mt-4 text-lg font-medium ${dark?'text-zinc-100':'text-slate-800'}`}>No downloads yet</div><p className="mt-2 text-sm text-slate-500">Start from Downloader.</p></Glass>:downloads.map(item=><Glass dark={dark} key={item.id} className="px-5 py-4"><div className="flex items-center gap-4"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${dark?'border-white/10 bg-white/[.04] text-cyan-300':'border-white/80 bg-white/60 text-slate-500'}`}><Icon icon={item.status==='completed'?Check:item.status==='failed'?RefreshCw:item.status==='cancelled'?Square:Download} size={17}/></div><div className="min-w-0 flex-1"><div className={`truncate text-sm font-semibold ${dark?'text-zinc-100':'text-slate-800'}`}>{item.title}</div><div className="mt-1 truncate text-xs text-slate-400">{item.format}{item.filename?` • ${item.filename}`:''}</div></div><Status dark={dark} tone={item.status==='completed'?'green':item.status==='failed'?'red':item.status==='cancelled'?'neutral':'blue'}>{item.status}</Status></div></Glass>)}</div></section> }

function HistoryPage({ dark, history, setHistory }) { return <section className="space-y-8 animate-fadeSlideIn"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className={`text-[9px] font-semibold uppercase tracking-[.2em] ${dark?'text-cyan-400':'text-blue-600'}`}>HISTORY</div><h1 className={`mt-4 text-4xl font-medium tracking-[-.05em] sm:text-5xl ${dark?'text-white':'text-slate-900'}`}>Download history.</h1><p className="mt-4 text-sm text-slate-500">Saved locally on this computer.</p></div>{history.length>0&&<Button dark={dark} icon={Trash2} variant="secondary" onClick={()=>setHistory([])}>Clear</Button>}</div><div className="space-y-3">{history.length===0?<Glass dark={dark} hover={false} className="p-12 text-center"><History size={22} className={dark?'text-slate-700':'text-slate-400'}/><div className={`mt-4 text-lg font-medium ${dark?'text-zinc-100':'text-slate-800'}`}>History is empty</div></Glass>:history.map(item=><Glass dark={dark} key={item.id} className="px-5 py-4"><div className="flex items-center gap-4"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${dark?'border-emerald-400/15 bg-emerald-400/[.05] text-emerald-300':'border-emerald-200 bg-emerald-50 text-emerald-600'}`}><Check size={16}/></div><div className="min-w-0 flex-1"><div className={`truncate text-sm font-semibold ${dark?'text-zinc-100':'text-slate-800'}`}>{item.title}</div><div className="mt-1 truncate text-xs text-slate-400">{item.filename} • {item.format}</div><div className="mt-1 text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</div></div><button type="button" onClick={()=>setHistory(cur=>cur.filter(entry=>entry.id!==item.id))} className={`grid h-10 w-10 place-items-center rounded-full transition ${dark?'text-slate-700 hover:bg-rose-400/[.05] hover:text-rose-300':'text-slate-400 hover:bg-rose-50 hover:text-rose-500'}`}><Trash2 size={15}/></button></div></Glass>)}</div></section> }


function formatLicenseExpiry(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function OfflinePage({ dark, appVersion, onRetry }) {
  return <div className={dark ? 'app-root app-dark' : 'app-root app-light'}>
    {dark ? <div className="nebula-grid" /> : <div className="orion-background-orbs"><span /><span /><span /></div>}
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[560px] text-center animate-fadeSlideIn">
        <div className={`mx-auto grid h-20 w-20 place-items-center rounded-[24px] border ${dark ? 'border-rose-400/15 bg-white/[.03]' : 'border-white/80 bg-white/72 shadow-sm'}`}>
          <WifiOff size={30} className={dark ? 'text-rose-300' : 'text-slate-500'} />
        </div>
        <div className={`mt-6 text-2xl font-medium tracking-[-.04em] ${dark ? 'text-white' : 'text-slate-900'}`}>Internet connection required.</div>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">VIDORA requires an active internet connection to verify your license and access the application. Reconnect to continue.</p>
        <div className={`mx-auto mt-7 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[.16em] ${dark ? 'border-rose-400/15 bg-rose-400/[.05] text-rose-300' : 'border-rose-200 bg-rose-50/80 text-rose-600'}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> No internet connection
        </div>
        <div className="mt-6 flex justify-center">
          <Button dark={dark} onClick={onRetry} icon={Wifi}>Retry connection</Button>
        </div>
        <div className="mt-4 text-[9px] uppercase tracking-[.18em] text-slate-400">v{appVersion}</div>
      </div>
    </div>
    <style>{STYLE}</style>
  </div>
}

function LicenseCheckingPage({ dark, appVersion }) {
  return <div className={dark ? 'app-root app-dark' : 'app-root app-light'}>
    {dark ? <div className="nebula-grid" /> : <div className="orion-background-orbs"><span /><span /><span /></div>}
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="flex flex-col items-center text-center">
        <div className={`grid h-20 w-20 place-items-center rounded-[24px] border ${dark ? 'border-white/10 bg-white/[.03]' : 'border-white/80 bg-white/70 shadow-sm'}`}><VidoraLogo size={58} /></div>
        <div className={`mt-5 text-sm font-semibold tracking-[.16em] ${dark ? 'text-white' : 'text-slate-800'}`}>VIDORA</div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><RefreshCw size={13} className="animate-spin" />Checking license...</div>
        <div className="mt-3 text-[9px] uppercase tracking-[.18em] text-slate-400">v{appVersion}</div>
      </div>
    </div>
  </div>
}

function LicensePage({ dark, setDark, appVersion, savedMeta, onActivated }) {
  const [licenseKey,setLicenseKey]=useState(()=>localStorage.getItem(LICENSE_KEY_STORAGE)||'')
  const [machineId,setMachineId]=useState('')
  const [status,setStatus]=useState('idle')
  const [message,setMessage]=useState('')
  const [checking,setChecking]=useState(false)
  const [activatedMeta,setActivatedMeta]=useState(savedMeta||null)

  useEffect(()=>{
    let id=localStorage.getItem(MACHINE_ID_STORAGE)
    if(!id){
      const generated=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`
      id=`VIDORA-${generated}`
      localStorage.setItem(MACHINE_ID_STORAGE,id)
    }
    setMachineId(id)
  },[])

  const activate=async(event)=>{
    event.preventDefault()
    if(typeof navigator!=='undefined'&&!navigator.onLine){setStatus('error');setMessage('An internet connection is required to activate VIDORA.');return}
    const cleanKey=licenseKey.trim().toUpperCase()
    if(!cleanKey){setStatus('error');setMessage('Enter your VIDORA license key to continue.');return}
    if(!machineId){setStatus('error');setMessage('This PC could not be identified. Please restart VIDORA and try again.');return}
    setChecking(true);setStatus('checking');setMessage('Checking your license...')
    try{
      const response=await fetch(`${LICENSE_API_URL}/activate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseKey:cleanKey,machineId})})
      const data=await response.json().catch(()=>null)
      if(!response.ok||!data?.ok){setStatus('error');setMessage(data?.error||'The license could not be activated.');return}
      const meta={key:cleanKey,expiresAt:data?.license?.expiresAt||'',edition:data?.license?.edition||'BETA'}
      localStorage.setItem(LICENSE_KEY_STORAGE,cleanKey)
      localStorage.setItem(LICENSE_META_STORAGE,JSON.stringify(meta))
      setActivatedMeta(meta)
      setStatus('success')
      setMessage('License activated successfully.')
      window.setTimeout(()=>onActivated(meta),1400)
    }catch(error){setStatus('error');setMessage(error?.message||'Could not reach the VIDORA license server. Check your internet connection and try again.')}
    finally{setChecking(false)}
  }

  const expiry=formatLicenseExpiry(activatedMeta?.expiresAt||savedMeta?.expiresAt)
  const tone=status==='success'?'green':status==='error'?'red':status==='checking'?'blue':'neutral'

  return <div className={dark?'app-root app-dark':'app-root app-light'}>
    {dark?<div className="nebula-grid"/>:<div className="orion-background-orbs"><span/><span/><span/></div>}
    <header className="px-4 pt-4 sm:px-6 lg:px-8"><div className={`mx-auto flex h-16 max-w-[1180px] items-center justify-between rounded-full px-4 ${dark?'topbar-dark':'topbar-light'}`}>
      <div className="flex items-center gap-3"><div className={`grid h-11 w-11 place-items-center rounded-2xl border ${dark?'border-white/10 bg-white/[.04]':'border-white/80 bg-white/70 shadow-sm'}`}><VidoraLogo size={38}/></div><div><div className={`text-sm font-semibold tracking-[.12em] ${dark?'text-white':'text-slate-800'}`}>VIDORA</div><div className={`mt-1 text-[9px] uppercase tracking-[.16em] ${dark?'text-slate-600':'text-slate-400'}`}>License activation</div></div></div>
      <div className="flex items-center gap-2"><span className={`hidden rounded-full border px-3 py-2 text-[9px] font-semibold uppercase tracking-[.14em] sm:inline-flex ${dark?'border-white/10 bg-white/[.03] text-slate-500':'border-white/80 bg-white/60 text-slate-400'}`}>v{appVersion}</span><button type="button" onClick={()=>setDark(v=>!v)} className={`theme-switch ${dark?'theme-switch-dark':'theme-switch-light'}`} title={dark?'Switch to Orion light theme':'Switch to Nebula dark theme'}>{dark?<Sun size={16}/>:<Moon size={16}/>}</button></div>
    </div></header>

    <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-[1100px] items-center justify-center px-4 py-10 sm:px-6"><div className="w-full max-w-[820px] animate-fadeSlideIn">
      <div className="text-center"><div className={dark?'theme-badge-dark':'theme-badge-light'}><ShieldCheck size={12} className={dark?'text-cyan-300':'text-blue-600'}/>SECURE ACTIVATION</div><h1 className={`mt-6 text-5xl font-medium tracking-[-.06em] sm:text-6xl ${dark?'text-white':'text-slate-900'}`}>Activate VIDORA.</h1><p className="mx-auto mt-5 max-w-[700px] text-sm leading-7 text-slate-500">Enter the license key supplied with your VIDORA access. Activation is tied to this PC and verified by the VIDORA license server.</p></div>
      <Glass dark={dark} hover={false} className="mt-8 overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4"><div><div className={`text-[9px] font-semibold uppercase tracking-[.2em] ${dark?'text-cyan-400':'text-blue-600'}`}>LICENSE KEY</div><div className={`mt-2 text-lg font-medium ${dark?'text-zinc-100':'text-slate-800'}`}>Enter your activation key</div></div><Status dark={dark} tone={tone}>{status==='checking'?'Checking':status==='success'?'Active':status==='error'?'Locked':'Required'}</Status></div>
          <form onSubmit={activate} className="mt-6">
            <label className="sr-only" htmlFor="vidora-license-key">VIDORA license key</label>
            <div className={`flex h-14 items-center gap-3 rounded-2xl border px-4 transition-all ${status==='error'?'border-rose-400/45':''} ${dark?'border-white/10 bg-black/20 focus-within:border-cyan-400/45 focus-within:ring-4 focus-within:ring-cyan-400/10':'border-white/80 bg-white/65 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100/60'}`}><ShieldCheck size={17} className={dark?'text-slate-600':'text-slate-400'}/><input id="vidora-license-key" type="text" value={licenseKey} onChange={e=>{setLicenseKey(e.target.value.toUpperCase());setStatus('idle');setMessage('')}} placeholder="VDR-BETA-XXXX-XXXX-XXXX" autoComplete="off" spellCheck="false" disabled={checking} className={`min-w-0 flex-1 bg-transparent text-sm uppercase tracking-[.045em] outline-none ${dark?'text-white placeholder:text-slate-700':'text-slate-700 placeholder:text-slate-400'}`}/>{licenseKey&&<button type="button" onClick={()=>{setLicenseKey('');setStatus('idle');setMessage('')}} aria-label="Clear license key" className={`grid h-7 w-7 place-items-center rounded-full border text-base leading-none transition-transform hover:scale-105 ${dark?'border-white/10 bg-white/[.04] text-slate-500':'border-slate-200 bg-white/70 text-slate-500'}`}>×</button>}</div>
            {message&&<div className={`mt-3 rounded-2xl border px-4 py-3 text-xs leading-5 ${status==='success'?(dark?'border-emerald-400/20 bg-emerald-400/[.05] text-emerald-300':'border-emerald-200 bg-emerald-50 text-emerald-700'):(dark?'border-rose-400/20 bg-rose-400/[.05] text-rose-300':'border-rose-200 bg-rose-50 text-rose-700')}`}>{message}</div>}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-[10px] text-slate-500">Only the Activate VIDORA button submits your key.</div><Button dark={dark} type="submit" disabled={checking||!licenseKey.trim()} icon={checking?RefreshCw:ArrowRight}>{checking?'Checking...':'Activate VIDORA'}</Button></div>
          </form>
        </div>
        <div className={`border-t p-5 sm:p-6 ${dark?'border-white/10':'border-slate-200/60'}`}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className={`rounded-2xl border p-4 ${dark?'border-white/10 bg-white/[.02]':'border-white/80 bg-white/50'}`}><div className={`grid h-9 w-9 place-items-center rounded-xl border ${dark?'border-white/10 bg-white/[.03] text-cyan-300':'border-white/80 bg-white/70 text-slate-500'}`}><Monitor size={15}/></div><div className={`mt-3 text-xs font-semibold ${dark?'text-zinc-100':'text-slate-800'}`}>This PC</div><div className="mt-1 text-[10px] text-slate-500">One activation per license.</div></div>
            <div className={`rounded-2xl border p-4 ${dark?'border-white/10 bg-white/[.02]':'border-white/80 bg-white/50'}`}><div className={`grid h-9 w-9 place-items-center rounded-xl border ${dark?'border-white/10 bg-white/[.03] text-emerald-300':'border-white/80 bg-white/70 text-emerald-600'}`}><CircleCheck size={15}/></div><div className={`mt-3 text-xs font-semibold ${dark?'text-zinc-100':'text-slate-800'}`}>Server verified</div><div className="mt-1 text-[10px] text-slate-500">Status checked online.</div></div>
            <div className={`rounded-2xl border p-4 ${dark?'border-white/10 bg-white/[.02]':'border-white/80 bg-white/50'}`}><div className={`grid h-9 w-9 place-items-center rounded-xl border ${dark?'border-white/10 bg-white/[.03] text-cyan-300':'border-white/80 bg-white/70 text-slate-500'}`}><History size={15}/></div><div className={`mt-3 text-xs font-semibold ${dark?'text-zinc-100':'text-slate-800'}`}>Expiration</div><div className="mt-1 text-[10px] text-slate-500">{expiry||'Shown after activation'}</div></div>
          </div>
          <div className={`mt-3 flex gap-3 rounded-2xl border px-4 py-3 ${dark?'border-amber-400/15 bg-amber-400/[.03]':'border-amber-200 bg-amber-50/70'}`}><ShieldCheck size={16} className={dark?'mt-0.5 shrink-0 text-amber-300':'mt-0.5 shrink-0 text-amber-600'}/><div><div className={`text-[11px] font-semibold ${dark?'text-zinc-200':'text-slate-700'}`}>License security</div><div className="mt-1 text-[10px] leading-5 text-slate-500">Unauthorized use, activation abuse, key sharing, or other suspicious activity may result in the license being disabled.</div></div></div>
        </div>
      </Glass>
    </div></main>
    <style>{STYLE}</style>
  </div>
}

function UpdatesPage({ dark, appVersion = FALLBACK_APP_VERSION }) {
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  const checking = status === 'checking'
  const downloading = status === 'downloading'
  const installing = status === 'installing'
  const complete = status === 'complete'
  const busy = checking || downloading || installing

  useEffect(() => {
    const installedVersion = localStorage.getItem('vidora-update-installed-version')

    if (installedVersion === appVersion) {
      localStorage.removeItem('vidora-update-installed-version')
      setProgress(100)
      setStatus('complete')
    }
  }, [])

  useEffect(() => {
    const subscribe = window.desktop?.onUpdaterEvent

    if (typeof subscribe !== 'function') {
      return undefined
    }

    const unsubscribe = subscribe((payload = {}) => {
      switch (payload.event) {
        case 'checking-for-update':
          setErrorMessage('')
          setProgress(0)
          setStatus('checking')
          break

        case 'update-available':
          setErrorMessage('')
          setProgress(0)
          setStatus('downloading')
          break

        case 'download-progress':
          setErrorMessage('')
          setProgress(
            Math.max(
              0,
              Math.min(
                100,
                Number(payload.percent) || 0,
              ),
            ),
          )
          setStatus('downloading')
          break

        case 'update-downloaded':
          setErrorMessage('')
          setProgress(100)
          setStatus('installing')

          localStorage.setItem(
            'vidora-update-installed-version',
            payload.version || '',
          )

          window.desktop?.installUpdate?.().catch?.(() => {})
          break

        case 'update-not-available':
          setErrorMessage('')
          setProgress(100)
          setStatus('complete')
          break

        case 'update-cancelled':
          setProgress(0)
          setStatus('idle')
          break

        case 'error':
          setProgress(0)
          setStatus('idle')
          setErrorMessage(
            payload.message || 'Could not check for updates.',
          )
          break

        default:
          break
      }
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  const checkForUpdates = async () => {
    if (busy) {
      return
    }

    setErrorMessage('')
    setProgress(0)
    setStatus('checking')

    try {
      const result = await window.desktop?.checkForUpdates?.()

      if (!result) {
        throw new Error('Update service is unavailable.')
      }

      if (result.status === 'current' || result.status === 'unavailable') {
        setProgress(100)
        setStatus('complete')
        return
      }

      if (result.status === 'error') {
        throw new Error(
          result.message || 'Could not check for updates.',
        )
      }

      if (result.status === 'available') {
        setStatus('downloading')
        return
      }

      if (result.status === 'disabled-in-development') {
        setProgress(100)
        setStatus('complete')
      }
    } catch (error) {
      setProgress(0)
      setStatus('idle')
      setErrorMessage(
        error?.message || 'Could not check for updates.',
      )
    }
  }

  return (
    <section className="mx-auto max-w-[760px] space-y-8 animate-fadeSlideIn">
      <div className="text-center">
        <div
          className={`text-[9px] font-semibold uppercase tracking-[.2em] ${dark ? 'text-cyan-400' : 'text-blue-600'}`}
        >
          UPDATES
        </div>

        <h1
          className={`mt-4 text-4xl font-medium tracking-[-.05em] sm:text-5xl ${dark ? 'text-white' : 'text-slate-900'}`}
        >
          Keep VIDORA current.
        </h1>
      </div>

      <Glass
        dark={dark}
        hover={false}
        className="relative overflow-hidden px-6 py-14 sm:px-10 sm:py-16"
      >
        <div
          className={`absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] ${dark ? 'bg-cyan-400/10' : 'bg-blue-400/10'}`}
        />

        <div className="relative mx-auto flex max-w-[520px] flex-col items-center text-center">
          {complete ? (
            <>
              <div
                className={`grid h-16 w-16 place-items-center rounded-full border ${dark ? 'border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`}
              >
                <Check size={28} strokeWidth={2} />
              </div>

              <div
                className={`mt-6 text-2xl font-medium tracking-tight ${dark ? 'text-zinc-100' : 'text-slate-800'}`}
              >
                You’re up to date.
              </div>
            </>
          ) : installing ? (
            <>
              <div
                className={`grid h-16 w-16 place-items-center rounded-full border ${dark ? 'border-blue-400/20 bg-blue-400/[.07] text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-600'}`}
              >
                <Upload size={26} className="animate-pulse" />
              </div>

              <div
                className={`mt-6 text-2xl font-medium tracking-tight ${dark ? 'text-zinc-100' : 'text-slate-800'}`}
              >
                Updating VIDORA…
              </div>

              <div
                className={`mt-7 h-2 w-full overflow-hidden rounded-full ${dark ? 'bg-white/[.06]' : 'bg-slate-200/70'}`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"
                  style={{ width: '100%' }}
                />
              </div>
            </>
          ) : downloading ? (
            <>
              <div
                className={`grid h-16 w-16 place-items-center rounded-full border ${dark ? 'border-blue-400/20 bg-blue-400/[.07] text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-600'}`}
              >
                <Download size={26} className="animate-pulse" />
              </div>

              <div
                className={`mt-6 text-2xl font-medium tracking-tight ${dark ? 'text-zinc-100' : 'text-slate-800'}`}
              >
                Downloading update…
              </div>

              <div
                className={`mt-7 h-2 w-full overflow-hidden rounded-full ${dark ? 'bg-white/[.06]' : 'bg-slate-200/70'}`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : checking ? (
            <>
              <div
                className={`grid h-16 w-16 place-items-center rounded-full border ${dark ? 'border-cyan-400/20 bg-cyan-400/[.06] text-cyan-300' : 'border-blue-200 bg-blue-50 text-blue-600'}`}
              >
                <RefreshCw size={26} className="animate-spin" />
              </div>

              <div
                className={`mt-6 text-2xl font-medium tracking-tight ${dark ? 'text-zinc-100' : 'text-slate-800'}`}
              >
                Checking for updates…
              </div>

              <div
                className={`mt-7 h-2 w-full overflow-hidden rounded-full ${dark ? 'bg-white/[.06]' : 'bg-slate-200/70'}`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div
                className={`grid h-16 w-16 place-items-center rounded-full border ${dark ? 'border-white/10 bg-white/[.04] text-cyan-300' : 'border-white/80 bg-white/70 text-blue-600'}`}
              >
                <ShieldCheck size={27} />
              </div>

              <div
                className={`mt-6 text-2xl font-medium tracking-tight ${dark ? 'text-zinc-100' : 'text-slate-800'}`}
              >
                Check for updates
              </div>

              <Button
                dark={dark}
                onClick={checkForUpdates}
                icon={Search}
                className="mt-7"
              >
                Check for updates
              </Button>

              {errorMessage && (
                <div
                  className={`mt-5 rounded-2xl border px-4 py-3 text-xs ${dark ? 'border-rose-400/15 bg-rose-400/[.05] text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-600'}`}
                >
                  {errorMessage}
                </div>
              )}
            </>
          )}
        </div>
      </Glass>
    </section>
  )
}
function SettingsPage({ dark, setDark, downloadPath, historyCount, chooseDownloadFolder, onUpdates, appVersion = FALLBACK_APP_VERSION }) {
  return <section className="space-y-8 animate-fadeSlideIn">
    <div>
      <div className={`text-[9px] font-semibold uppercase tracking-[.2em] ${dark?'text-cyan-400':'text-blue-600'}`}>SETTINGS</div>
      <h1 className={`mt-4 text-4xl font-medium tracking-[-.05em] sm:text-5xl ${dark?'text-white':'text-slate-900'}`}>Preferences.</h1>
      <p className="mt-4 text-sm text-slate-500">Tune your VIDORA workspace.</p>
    </div>
    <Glass dark={dark} hover={false} className="overflow-hidden divide-y">
      <button type="button" onClick={()=>setDark(v=>!v)} className={`flex w-full items-center justify-between gap-5 px-6 py-6 text-left transition ${dark?'hover:bg-white/[.02]':'hover:bg-white/35'}`}>
        <div className="flex items-center gap-4">
          <div className={`grid h-11 w-11 place-items-center rounded-2xl border ${dark?'border-white/10 bg-white/[.04] text-cyan-300':'border-white/80 bg-white/65 text-slate-500'}`}>{dark?<Moon size={17}/>:<Sun size={17}/>}</div>
          <div><div className={`text-sm font-semibold ${dark?'text-zinc-100':'text-slate-800'}`}>Appearance</div><div className="mt-1 text-xs text-slate-500">Nebula dark theme or Orion light theme.</div></div>
        </div>
        <div className={`relative h-8 w-14 rounded-full border p-1 ${dark?'border-cyan-400/25 bg-cyan-400/10':'border-slate-200 bg-slate-100'}`}><div className={`h-6 w-6 rounded-full shadow-sm transition-transform duration-500 ${dark?'translate-x-6 bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,.35)]':'bg-white'}`}/></div>
      </button>
      <button type="button" onClick={chooseDownloadFolder} className={`flex w-full items-center justify-between gap-5 px-6 py-6 text-left transition ${dark?'hover:bg-white/[.02]':'hover:bg-white/35'}`}>
        <div className="flex min-w-0 items-center gap-4"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${dark?'border-white/10 bg-white/[.04] text-cyan-300':'border-white/80 bg-white/65 text-slate-500'}`}><FolderOpen size={17}/></div><div className="min-w-0"><div className={`text-sm font-semibold ${dark?'text-zinc-100':'text-slate-800'}`}>Download location</div><div className="mt-1 max-w-[700px] truncate text-xs text-slate-500">{downloadPath}</div></div></div><ChevronRight size={16} className="text-slate-400"/>
      </button>

      <button type="button" onClick={onUpdates} className={`flex w-full items-center justify-between gap-5 px-6 py-6 text-left transition ${dark?'hover:bg-white/[.02]':'hover:bg-white/35'}`}>
        <div className="flex items-center gap-4"><div className={`grid h-11 w-11 place-items-center rounded-2xl border ${dark?'border-white/10 bg-white/[.04] text-cyan-300':'border-white/80 bg-white/65 text-slate-500'}`}><Upload size={17}/></div><div><div className={`text-sm font-semibold ${dark?'text-zinc-100':'text-slate-800'}`}>Updates</div><div className="mt-1 text-xs text-slate-500">Check for a newer version.</div></div></div><ChevronRight size={16} className="text-slate-400"/>
      </button>
      <div className="flex items-center justify-between gap-5 px-6 py-6"><div className="flex items-center gap-4"><div className={`grid h-11 w-11 place-items-center rounded-2xl border ${dark?'border-white/10 bg-white/[.04] text-cyan-300':'border-white/80 bg-white/65 text-slate-500'}`}><History size={17}/></div><div><div className={`text-sm font-semibold ${dark?'text-zinc-100':'text-slate-800'}`}>Download history</div><div className="mt-1 text-xs text-slate-500">{historyCount} saved entries</div></div></div><Status dark={dark} tone="blue">Local</Status></div>
      <div className="flex items-center justify-between gap-5 px-6 py-6"><div className="flex items-center gap-4"><div className={`grid h-11 w-11 place-items-center rounded-2xl border ${dark?'border-white/10 bg-white/[.04] text-cyan-300':'border-white/80 bg-white/65 text-slate-500'}`}><Monitor size={17}/></div><div><div className={`text-sm font-semibold ${dark?'text-zinc-100':'text-slate-800'}`}>Application</div><div className="mt-1 text-xs text-slate-500">VIDORA Desktop</div></div></div><span className="text-xs font-semibold text-slate-400">{appVersion}</span></div>
    </Glass>
  </section>
}

export default function App() {
  const [active,setActive]=useState('home')
  const [appVersion,setAppVersion]=useState(FALLBACK_APP_VERSION)
  const [licenseState,setLicenseState]=useState('checking')
  const [licenseInfo,setLicenseInfo]=useState(()=>loadJSON(LICENSE_META_STORAGE,null))
  const [online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine)
  const [darkState,setDarkState]=useState(()=>localStorage.getItem(THEME_KEY)!=='light')
  const [downloadPath,setDownloadPath]=useState(()=>localStorage.getItem(DOWNLOAD_PATH_KEY)||'Default Downloads folder')
  const [url,setUrl]=useState('')
  const [videoInfo,setVideoInfo]=useState(null)
  const [isAnalyzing,setIsAnalyzing]=useState(false)
  const [error,setError]=useState('')
  const [history,setHistory]=useState(()=>loadJSON(HISTORY_KEY,[]))
  const [downloads,setDownloads]=useState([])
  const [downloadState,setDownloadState]=useState({status:'idle',message:'',filename:'',filepath:'',format:'',jobId:''})
  const [bulkText,setBulkText]=useState('')
  const [bulkQuality,setBulkQuality]=useState('best')
  const [bulkState,setBulkState]=useState({status:'idle',message:'',total:0,successful:0,failed:0,filename:'',downloadUrl:'',jobId:''})
  const qualityRef=useRef(null)
  const downloadSectionRef=useRef(null)
  const bulkRef=useRef(null)
  const dark=darkState
  const setDark=value=>setDarkState(current=>{const next=typeof value==='function'?value(current):value;localStorage.setItem(THEME_KEY,next?'dark':'light');return next})
  const videoFormats=useMemo(()=>getVideoFormats(videoInfo?.formats),[videoInfo])
  const audioFormats=useMemo(()=>getAudioFormats(videoInfo?.formats),[videoInfo])
  const bulkUrls=useMemo(()=>bulkText.split(/\r?\n|,/).map(v=>v.trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i),[bulkText])

  useEffect(()=>{let cancelled=false;const loadVersion=async()=>{try{const version=await window.desktop?.getVersion?.();if(!cancelled&&version)setAppVersion(version)}catch(error){console.warn('VIDORA version lookup failed:',error)}};loadVersion();return()=>{cancelled=true}},[])


  useEffect(()=>{
    let cancelled=false
    let heartbeatId=null

    const goOffline=()=>{
      if(cancelled)return
      setOnline(false)
      setLicenseState('offline')
      setIsAnalyzing(false)
      setDownloadState(current=>current.status==='downloading'||current.status==='cancelling'?{...current,status:'error',message:'An internet connection is required. Download stopped.'}:current)
      setBulkState(current=>current.status==='processing'||current.status==='cancelling'?{...current,status:'error',message:'An internet connection is required. Bulk processing stopped.',total:current.total,successful:current.successful,failed:current.failed}:current)
    }

    const checkInternet=async()=>{
      if(typeof navigator!=='undefined'&&!navigator.onLine){goOffline();return}
      try{
        await fetch('https://www.cloudflare.com/cdn-cgi/trace',{method:'GET',cache:'no-store',mode:'no-cors'})
        if(!cancelled)setOnline(true)
      }catch{
        goOffline()
      }
    }

    const handleOnline=()=>{
      if(cancelled)return
      setOnline(true)
      setLicenseState('checking')
    }

    const handleOffline=()=>goOffline()

    window.addEventListener('online',handleOnline)
    window.addEventListener('offline',handleOffline)

    if(!online){goOffline()}

    const verifyStoredLicense=async()=>{
      if(!online)return
      try{
        let machineId=localStorage.getItem(MACHINE_ID_STORAGE)
        if(!machineId){const generated=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;machineId=`VIDORA-${generated}`;localStorage.setItem(MACHINE_ID_STORAGE,machineId)}
        const storedKey=localStorage.getItem(LICENSE_KEY_STORAGE)
        if(!storedKey){if(!cancelled)setLicenseState('required');return}
        const response=await fetch(`${LICENSE_API_URL}/activate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseKey:storedKey,machineId}),cache:'no-store'})
        const data=await response.json().catch(()=>null)
        if(!cancelled&&response.ok&&data?.ok){
          const meta={key:storedKey,expiresAt:data?.license?.expiresAt||'',edition:data?.license?.edition||'BETA'}
          localStorage.setItem(LICENSE_META_STORAGE,JSON.stringify(meta))
          setLicenseInfo(meta)
          setLicenseState('unlocked')
        }else if(!cancelled){
          localStorage.removeItem(LICENSE_KEY_STORAGE)
          localStorage.removeItem(LICENSE_META_STORAGE)
          setLicenseInfo(null)
          setLicenseState('required')
        }
      }catch(error){
        console.warn('VIDORA license validation failed:',error)
        if(!cancelled)goOffline()
      }
    }

    verifyStoredLicense()
    heartbeatId=window.setInterval(checkInternet,10000)
    return()=>{
      cancelled=true
      if(heartbeatId)window.clearInterval(heartbeatId)
      window.removeEventListener('online',handleOnline)
      window.removeEventListener('offline',handleOffline)
    }
  },[online])

  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';document.body.style.background=dark?'#000':'#f7f9fa';document.body.style.color=dark?'#fff':'#1a1a24'},[dark])
  useEffect(()=>localStorage.setItem(HISTORY_KEY,JSON.stringify(history)),[history])
  useEffect(()=>localStorage.setItem(DOWNLOAD_PATH_KEY,downloadPath),[downloadPath])

  const smoothScrollTo=ref=>{
    window.requestAnimationFrame(()=>{
      window.requestAnimationFrame(()=>{
        if (!ref.current) return
        ref.current.scrollIntoView({behavior:'smooth',block:'center'})
      })
    })
  }
  const chooseDownloadFolder=async()=>{if(!online){setLicenseState('offline');return}try{const selected=await window.desktop?.chooseFolder?.();if(selected){setDownloadPath(selected);setError('')}}catch(e){console.error(e);setError('Windows could not open the folder picker.')}}
  const addHistory=entry=>setHistory(current=>[{id:makeJobId(),...entry,createdAt:new Date().toISOString()},...current].slice(0,100))

  const analyze=async()=>{if(!online){setLicenseState('offline');return}const cleanUrl=url.trim();if(!cleanUrl){setError('Paste a video link first.');return}setError('');setVideoInfo(null);setIsAnalyzing(true);try{const response=await fetch(`${API_BASE_URL}/info`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:cleanUrl})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.detail||`Analyze failed with status ${response.status}`);setVideoInfo(data);smoothScrollTo(qualityRef)}catch(e){setError(e?.message||'Could not analyze this link.')}finally{setIsAnalyzing(false)}}
  const paste=async()=>{if(!online){setLicenseState('offline');return}try{const text=await navigator.clipboard.readText();if(!text.trim())throw new Error('Clipboard is empty.');setUrl(text.trim());setError('')}catch(e){setError(e?.message||'Clipboard access is unavailable.')}}

  const download=async(formatId,label,isMp3=false)=>{if(!online){setLicenseState('offline');return}const cleanUrl=url.trim();if(!cleanUrl||!formatId)return;const jobId=makeJobId();const prettyFormat=isMp3?'MP3':label;const backendFormatId=isMp3?`mp3:${formatId}`:formatId;const item={id:jobId,title:videoInfo?.title||'Untitled video',format:prettyFormat,filename:'',status:'downloading'};setError('');setDownloads(c=>[item,...c]);setDownloadState({status:'downloading',message:`Downloading ${prettyFormat}...`,filename:'',filepath:'',format:prettyFormat,jobId});smoothScrollTo(downloadSectionRef);try{const response=await fetch(`${API_BASE_URL}/download`,{method:'POST',headers:{'Content-Type':'application/json','X-VIDORA-Job-ID':jobId},body:JSON.stringify({url:cleanUrl,format_id:backendFormatId,download_path:downloadPath==='Default Downloads folder'?null:downloadPath})});const data=await response.json().catch(()=>null);if(response.status===499){setDownloadState(c=>({...c,status:'cancelled',message:'Download cancelled.'}));setDownloads(c=>c.map(e=>e.id===item.id?{...e,status:'cancelled'}:e));smoothScrollTo(downloadSectionRef);return}if(!response.ok)throw new Error(data?.detail||`Download failed with status ${response.status}`);setDownloadState({status:'success',message:'Download complete.',filename:data?.filename||'',filepath:data?.filepath||'',format:prettyFormat,jobId});smoothScrollTo(downloadSectionRef);setDownloads(c=>c.map(e=>e.id===item.id?{...e,filename:data?.filename||'',status:'completed'}:e));addHistory({filename:data?.filename||'',format:prettyFormat,title:videoInfo?.title||'Untitled video',url:cleanUrl})}catch(e){setDownloadState({status:'error',message:e?.message||'Download failed.',filename:'',filepath:'',format:prettyFormat,jobId});smoothScrollTo(downloadSectionRef);setDownloads(c=>c.map(entry=>entry.id===item.id?{...entry,status:'failed'}:entry))}}

  const resetDownloader=()=>{
    if(downloadState.status==='downloading'||downloadState.status==='cancelling')return
    setUrl('')
    setVideoInfo(null)
    setError('')
    setDownloadState({status:'idle',message:'',filename:'',filepath:'',format:'',jobId:''})
    window.requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'}))
  }

  const cancelDownload=async()=>{if(!online)return;const jobId=downloadState.jobId;if(!jobId||downloadState.status!=='downloading')return;setDownloadState(c=>({...c,status:'cancelling',message:'Cancelling download...'}));try{const response=await fetch(`${API_BASE_URL}/cancel/${encodeURIComponent(jobId)}`,{method:'POST'});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.detail||'Could not cancel the download.')}catch(e){setDownloadState(c=>({...c,status:'downloading',message:'Download is still running.'}));setError(e?.message||'Could not cancel the download.')}}

  const bulkActiveJobRef = useRef('')
  const bulkCancelRequestedRef = useRef(false)

  const startBulkDownload = async () => {
    if (!online) {
      setLicenseState('offline')
      return
    }

    if (!bulkUrls.length) {
      setError('Add at least one video link.')
      return
    }

    if (bulkUrls.length > 20) {
      setError('Maximum 20 links per batch.')
      return
    }

    const urls = [...bulkUrls]
    const batchId = makeJobId()
    bulkCancelRequestedRef.current = false
    let successful = 0
    let failed = 0
    const results = []

    setError('')
    setBulkState({
      status: 'processing',
      message: `Preparing 0 of ${urls.length} downloads...`,
      total: urls.length,
      successful: 0,
      failed: 0,
      filename: '',
      downloadUrl: '',
      jobId: batchId,
    })
    smoothScrollTo(bulkRef)

    const chooseFormatId = (formats = []) => {
      const available = getVideoFormats(formats)
      if (!available.length) return ''

      if (bulkQuality === 'best') return available[0].formatId

      const limit = Number(bulkQuality.replace('p', ''))
      const atOrBelow = available.filter((entry) => Number(entry.height) <= limit)
      if (atOrBelow.length) return atOrBelow[0].formatId
      return available[available.length - 1].formatId
    }

    try {
      for (let index = 0; index < urls.length; index += 1) {
        if (bulkCancelRequestedRef.current) break
        const itemUrl = urls[index]
        const itemJobId = makeJobId()
        bulkActiveJobRef.current = itemJobId

        setBulkState((current) => ({
          ...current,
          status: 'processing',
          message: `Downloading ${index + 1} of ${urls.length}...`,
          successful,
          failed,
          jobId: batchId,
        }))

        try {
          const infoResponse = await fetch(`${API_BASE_URL}/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: itemUrl }),
          })
          const infoData = await infoResponse.json().catch(() => null)
          if (!infoResponse.ok) {
            throw new Error(infoData?.detail || `Analyze failed with status ${infoResponse.status}`)
          }

          const formatId = chooseFormatId(infoData?.formats || [])
          if (!formatId) throw new Error('No downloadable video format is available for this link.')

          const downloadResponse = await fetch(`${API_BASE_URL}/download`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-VIDORA-Job-ID': itemJobId,
            },
            body: JSON.stringify({
              url: itemUrl,
              format_id: formatId,
              download_path: downloadPath === 'Default Downloads folder' ? null : downloadPath,
            }),
          })

          const downloadData = await downloadResponse.json().catch(() => null)

          if (downloadResponse.status === 499) {
            throw new Error('Download cancelled.')
          }

          if (!downloadResponse.ok) {
            throw new Error(downloadData?.detail || `Download failed with status ${downloadResponse.status}`)
          }

          if (!downloadData?.filename || !downloadData?.filepath) {
            throw new Error('The downloader did not return a completed file.')
          }

          successful += 1
          results.push({
            title: infoData?.title || 'Untitled video',
            filename: downloadData.filename,
            format: bulkQuality === 'best' ? 'Best available' : `Up to ${bulkQuality}`,
            url: itemUrl,
          })

          setDownloads((current) => [{
            id: itemJobId,
            title: infoData?.title || 'Untitled video',
            format: bulkQuality === 'best' ? 'Best available' : `Up to ${bulkQuality}`,
            filename: downloadData.filename,
            status: 'completed',
          }, ...current])

          addHistory({
            filename: downloadData.filename,
            format: `BULK • ${bulkQuality === 'best' ? 'Best available' : `Up to ${bulkQuality}`}`,
            title: infoData?.title || 'Untitled video',
            url: itemUrl,
          })
        } catch (itemError) {
          failed += 1
          results.push({
            title: 'Failed item',
            filename: '',
            format: bulkQuality,
            url: itemUrl,
            error: itemError?.message || 'Download failed.',
          })
        }

        setBulkState((current) => ({
          ...current,
          status: 'processing',
          message: `Completed ${index + 1} of ${urls.length} downloads.`,
          successful,
          failed,
          total: urls.length,
          jobId: batchId,
        }))
      }

      if (bulkCancelRequestedRef.current) {
        setBulkState({
          status: 'cancelled',
          message: `Bulk download cancelled: ${successful} downloaded, ${failed} failed.`,
          total: urls.length,
          successful,
          failed,
          filename: '',
          downloadUrl: '',
          jobId: batchId,
        })
        smoothScrollTo(bulkRef)
        return
      }

      const finalStatus = failed === 0 ? 'success' : successful > 0 ? 'partial' : 'error'
      setBulkState({
        status: finalStatus,
        message: failed === 0
          ? `Bulk download complete: ${successful} of ${urls.length} downloaded.`
          : `${successful} downloaded, ${failed} failed.`,
        total: urls.length,
        successful,
        failed,
        filename: '',
        downloadUrl: '',
        jobId: batchId,
      })
      smoothScrollTo(bulkRef)
    } finally {
      bulkActiveJobRef.current = ''
    }
  }

  const cancelBulkDownload = async () => {
    if (!online) return
    const jobId = bulkActiveJobRef.current
    if (!jobId || bulkState.status !== 'processing') return

    bulkCancelRequestedRef.current = true

    setBulkState((current) => ({ ...current, status: 'cancelling', message: 'Cancelling bulk download...' }))

    try {
      const response = await fetch(`${API_BASE_URL}/cancel/${encodeURIComponent(jobId)}`, { method: 'POST' })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.detail || 'Could not cancel the bulk download.')
      setBulkState((current) => ({ ...current, status: 'cancelled', message: 'Bulk download cancelled.' }))
      smoothScrollTo(bulkRef)
    } catch (e) {
      setBulkState((current) => ({ ...current, status: 'processing', message: 'Bulk download is still running.' }))
      setError(e?.message || 'Could not cancel the bulk download.')
      smoothScrollTo(bulkRef)
    }
  }

  const title=active==='downloader'?'Downloader':active==='bulk'?'Bulk':active==='downloads'?'Downloads':active==='history'?'History':active==='updates'?'Updates':active==='settings'?'Settings':'Home'
  if (!online || licenseState === 'offline') return <OfflinePage dark={dark} appVersion={appVersion} onRetry={()=>{setOnline(typeof navigator==='undefined'||navigator.onLine);if(typeof navigator==='undefined'||navigator.onLine)setLicenseState('checking')}} />
  if (licenseState === 'checking') return <LicenseCheckingPage dark={dark} appVersion={appVersion} />
  if (licenseState !== 'unlocked') return <LicensePage dark={dark} setDark={setDark} appVersion={appVersion} savedMeta={licenseInfo} onActivated={(info)=>{setLicenseInfo(info);setLicenseState('unlocked')}} />
  return <div className={dark?'app-root app-dark':'app-root app-light'}>{dark?<div className="nebula-grid"/>:<div className="orion-background-orbs"><span/><span/><span/></div>}<div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1700px]"><aside className="sticky top-0 hidden h-screen w-[270px] shrink-0 p-4 lg:block"><div className={dark?'sidebar-dark nebula-gradient-border':'sidebar-light-orion'}><div className="flex items-center gap-3 px-3 py-3"><div className={`grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border ${dark?'border-white/10 bg-white/[.05]':'border-white/80 bg-white/75 shadow-sm'}`}><VidoraLogo size={38}/></div><div><div className={`text-sm font-semibold tracking-[.12em] ${dark?'text-white':'text-slate-800'}`}>VIDORA</div><div className={`mt-1 text-[10px] ${dark?'text-slate-600':'text-slate-400'}`}>Your media. Your way.</div></div></div><div className={`mt-7 px-3 text-[9px] font-semibold uppercase tracking-[.2em] ${dark?'text-slate-600':'text-slate-400'}`}>Workspace</div><div className="mt-3 space-y-1.5">{navItems.map(nav=>{const selected=active===nav.id;return <button key={nav.id} type="button" onClick={()=>setActive(nav.id)} className={`nav-button ${selected?(dark?'nav-selected-dark':'nav-selected-light-orion'):(dark?'nav-idle-dark':'nav-idle-light-orion')}`}><PremiumNavIcon icon={nav.icon} dark={dark} active={selected}/>{nav.label}</button>})}</div><div className="mt-auto space-y-1.5 pt-4"><button type="button" onClick={()=>setActive('updates')} className={`nav-button ${active==='updates'?(dark?'nav-selected-dark':'nav-selected-light-orion'):(dark?'nav-idle-dark':'nav-idle-light-orion')}`}><PremiumNavIcon icon={Upload} dark={dark} active={active==='updates'}/>Updates</button><button type="button" onClick={()=>setActive('settings')} className={`nav-button ${active==='settings'?(dark?'nav-selected-dark':'nav-selected-light-orion'):(dark?'nav-idle-dark':'nav-idle-light-orion')}`}><PremiumNavIcon icon={Settings} dark={dark} active={active==='settings'}/>Settings</button></div></div></aside>
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-8"><div className={`topbar ${dark?'topbar-dark':'topbar-light'}`}><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[.04] lg:hidden"><VidoraLogo size={30}/></div><div><div className={`text-sm font-medium ${dark?'text-white':'text-slate-800'}`}>{title}</div><div className={`hidden text-[9px] uppercase tracking-[.16em] sm:block ${dark?'text-slate-600':'text-slate-400'}`}>VIDORA desktop workspace</div></div></div><div className="flex items-center gap-2"><button type="button" onClick={()=>setDark(v=>!v)} className={`theme-switch ${dark?'theme-switch-dark':'theme-switch-light'}`} title={dark?'Light theme':'Dark theme'}>{dark?<Sun size={16}/>:<Moon size={16}/>}</button><span className={`hidden rounded-full border px-3 py-2 text-[9px] font-semibold uppercase tracking-[.14em] sm:inline-flex ${dark?'border-white/10 bg-white/[.04] text-slate-600':'border-white/75 bg-white/50 text-slate-400'}`}>v{appVersion}</span>{licenseInfo?.expiresAt&&<span className={`hidden rounded-full border px-3 py-2 text-[9px] font-semibold uppercase tracking-[.12em] sm:inline-flex ${dark?'border-emerald-400/10 bg-emerald-400/[.03] text-emerald-300/80':'border-emerald-200/80 bg-emerald-50/70 text-emerald-600'}`}>Expires {formatLicenseExpiry(licenseInfo.expiresAt)}</span>}<button type="button" onClick={()=>setActive('settings')} className={`theme-switch ${dark?'theme-switch-dark':'theme-switch-light'}`}><Settings size={16}/></button></div></div></header><main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">{active==='home'&&<HomePage dark={dark} onStart={()=>setActive('downloader')}/>} {active==='downloader'&&<DownloaderPage dark={dark} url={url} setUrl={setUrl} videoInfo={videoInfo} videoFormats={videoFormats} audioFormats={audioFormats} isAnalyzing={isAnalyzing} error={error} setError={setError} analyze={analyze} paste={paste} download={download} cancelDownload={cancelDownload} downloadState={downloadState} qualityRef={qualityRef} downloadSectionRef={downloadSectionRef} resetDownloader={resetDownloader}/>} {active==='bulk'&&<BulkPage dark={dark} bulkText={bulkText} setBulkText={setBulkText} bulkQuality={bulkQuality} setBulkQuality={setBulkQuality} bulkState={bulkState} startBulkDownload={startBulkDownload} cancelBulkDownload={cancelBulkDownload} bulkRef={bulkRef}/>} {active==='downloads'&&<DownloadsPage dark={dark} downloads={downloads}/>} {active==='history'&&<HistoryPage dark={dark} history={history} setHistory={setHistory}/>} {active==='updates'&&<UpdatesPage dark={dark} appVersion={appVersion}/>} {active==='settings'&&<SettingsPage dark={dark} setDark={setDark} downloadPath={downloadPath} historyCount={history.length} chooseDownloadFolder={chooseDownloadFolder} onUpdates={()=>setActive('updates')} appVersion={appVersion}/>}</main></div></div><style>{STYLE}</style></div>
}

const STYLE = `
:root{--orion-primary:#1a1a24;--orion-muted:#5a5a6a}html,body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}button,input,textarea,select{font:inherit}
@keyframes fadeSlideIn{0%{opacity:0;transform:translateY(30px);filter:blur(8px)}100%{opacity:1;transform:translateY(0);filter:blur(0)}}
@keyframes floatingPoints{0%{transform:translateY(0);opacity:1}85%{opacity:0}100%{transform:translateY(-55px);opacity:0}}
@keyframes vidoraProgress{0%{transform:translateX(-130%)}100%{transform:translateX(330%)}}
@keyframes vidoraMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes trustedSitesScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes floatA{0%,100%{transform:translateY(0) rotate(-7deg)}50%{transform:translateY(-14px) rotate(-7deg)}}
@keyframes floatB{0%,100%{transform:translateY(0) rotate(6deg)}50%{transform:translateY(14px) rotate(6deg)}}
@keyframes showcasePulse{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes orionBars{0%,100%{transform:scaleY(.92)}50%{transform:scaleY(1.04)}}
@keyframes orionDeviceFloat{0%,100%{transform:translateY(0) rotateY(0)}50%{transform:translateY(-15px) rotateY(-2deg)}}
@keyframes orionPulse{0%,100%{opacity:.45;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
.animate-fadeSlideIn{animation:fadeSlideIn .8s ease-out .1s both}.animate-fadeSlideIn-delay-400{animation:fadeSlideIn .8s ease-out .4s both}.animate-float-a{animation:floatA 6s ease-in-out infinite}.animate-float-b{animation:floatB 6s ease-in-out .7s infinite}
.app-root{min-height:100vh;transition:background .45s ease,color .35s ease}.app-dark{background:#000;color:#fff}.app-light{background:radial-gradient(circle at 8% 12%,rgba(125,211,252,.12),transparent 22%),radial-gradient(circle at 86% 10%,rgba(191,219,254,.15),transparent 25%),linear-gradient(180deg,#f7f9fa,#f7f9fa 55%,#f7f9fa);color:var(--orion-primary)}
.nebula-grid{position:fixed;inset:0;pointer-events:none;opacity:.34;background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:48px 48px}.orion-background-orbs{position:fixed;inset:0;overflow:hidden;pointer-events:none}.orion-background-orbs span{position:absolute;border-radius:9999px;filter:blur(90px)}.orion-background-orbs span:nth-child(1){width:420px;height:420px;left:-150px;top:90px;background:rgba(125,211,252,.14)}.orion-background-orbs span:nth-child(2){width:360px;height:360px;right:-100px;top:40px;background:rgba(191,219,254,.18)}.orion-background-orbs span:nth-child(3){width:340px;height:340px;left:42%;bottom:-160px;background:rgba(226,232,240,.4)}
.sidebar-dark,.sidebar-light-orion{height:100%;display:flex;flex-direction:column;padding:16px;border-radius:34px;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}.sidebar-dark{background:linear-gradient(135deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.09);box-shadow:0 24px 70px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.06)}.sidebar-light-orion{background:rgba(255,255,255,.52);border:1px solid rgba(255,255,255,.78);box-shadow:0 25px 70px rgba(15,23,42,.065)}
.topbar{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 12px 0 20px;border-radius:999px;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}.topbar-dark{background:linear-gradient(135deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.09);box-shadow:0 14px 40px rgba(0,0,0,.2)}.topbar-light{background:rgba(255,255,255,.64);border:1px solid rgba(255,255,255,.76);box-shadow:0 12px 35px rgba(15,23,42,.05)}
.nav-button{position:relative;width:100%;display:flex;align-items:center;gap:12px;border-radius:18px;padding:8px 12px;text-align:left;font-size:12px;font-weight:600;transition:transform .42s cubic-bezier(.23,1,.32,1),background .32s ease,color .32s ease,box-shadow .32s ease}.nav-button:hover{transform:translateX(2px)}.nav-icon-pack{position:relative;display:grid;place-items:center;width:40px;height:40px;flex:none;border-radius:14px;overflow:visible;transition:transform .42s cubic-bezier(.23,1,.32,1),background .32s ease,border-color .32s ease,box-shadow .32s ease}.nav-icon-pack-core{position:relative;z-index:2;display:grid;place-items:center;width:34px;height:34px;border-radius:12px;border:1px solid;transition:transform .35s ease,color .3s ease,background .3s ease}.nav-icon-pack-glow{position:absolute;inset:4px;border-radius:13px;filter:blur(9px);opacity:0;transform:scale(.82);transition:opacity .35s ease,transform .35s ease}.nav-icon-pack-dark .nav-icon-pack-core{border-color:rgba(255,255,255,.06);background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012));color:#64748b;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 7px 20px rgba(0,0,0,.12)}.nav-icon-pack-dark .nav-icon-pack-glow{background:rgba(34,211,238,.28)}.nav-icon-pack-light .nav-icon-pack-core{border-color:rgba(255,255,255,.72);background:linear-gradient(145deg,rgba(255,255,255,.82),rgba(241,245,249,.46));color:#64748b;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 7px 18px rgba(15,23,42,.045)}.nav-icon-pack-light .nav-icon-pack-glow{background:rgba(37,99,235,.16)}.nav-icon-pack:hover{transform:translateY(-1px) scale(1.03)}.nav-icon-pack:hover .nav-icon-pack-core{transform:translateY(-1px)}.nav-icon-pack:hover .nav-icon-pack-glow{opacity:.55;transform:scale(1)}.nav-selected-dark{color:#f8fafc;background:linear-gradient(135deg,rgba(255,255,255,.085),rgba(255,255,255,.035));box-shadow:0 14px 34px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.04)}.nav-selected-dark:before{content:'';position:absolute;left:0;top:50%;width:3px;height:28px;transform:translateY(-50%);border-radius:999px;background:linear-gradient(180deg,#67e8f9,#22d3ee);box-shadow:0 0 16px rgba(34,211,238,.56)}.nav-selected-dark .nav-icon-pack-core{border-color:rgba(103,232,249,.28);background:linear-gradient(145deg,rgba(34,211,238,.13),rgba(34,211,238,.035));color:#67e8f9;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px rgba(34,211,238,.04),0 10px 28px rgba(34,211,238,.08)}.nav-selected-dark .nav-icon-pack-glow{opacity:.72;transform:scale(1)}.nav-selected-light-orion{color:#1e293b;background:linear-gradient(135deg,rgba(255,255,255,.88),rgba(255,255,255,.58));box-shadow:0 12px 28px rgba(15,23,42,.075),inset 0 1px 0 rgba(255,255,255,.96)}.nav-selected-light-orion:before{content:'';position:absolute;left:0;top:50%;width:3px;height:28px;transform:translateY(-50%);border-radius:999px;background:linear-gradient(180deg,#3b82f6,#60a5fa);box-shadow:0 0 14px rgba(59,130,246,.26)}.nav-selected-light-orion .nav-icon-pack-core{border-color:rgba(59,130,246,.18);background:linear-gradient(145deg,rgba(239,246,255,.96),rgba(219,234,254,.55));color:#2563eb;box-shadow:inset 0 1px 0 rgba(255,255,255,.96),0 8px 22px rgba(37,99,235,.08)}.nav-selected-light-orion .nav-icon-pack-glow{opacity:.62;transform:scale(1)}.nav-idle-dark{color:#64748b}.nav-idle-dark:hover{color:#e2e8f0;background:rgba(255,255,255,.032)}.nav-idle-light-orion{color:#94a3b8}.nav-idle-light-orion:hover{color:#334155;background:rgba(255,255,255,.48)}
.nebula-card,.nebula-hero{position:relative;background:linear-gradient(135deg,rgba(255,255,255,.05),rgba(255,255,255,.012));border:1px solid rgba(255,255,255,.09);border-radius:32px;backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);box-shadow:0 24px 70px rgba(0,0,0,.23),inset 0 1px 0 rgba(255,255,255,.06)}.orion-glass-panel,.orion-hero{border:1px solid rgba(255,255,255,.76);border-radius:32px;background:rgba(255,255,255,.42);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 25px 75px rgba(15,23,42,.065),inset 0 1px 0 rgba(255,255,255,.88)}.surface-hover{transition:transform .35s ease,box-shadow .35s ease,background .35s ease}.surface-hover:hover{transform:translateY(-3px)}.nebula-gradient-border{position:relative;overflow:hidden}.nebula-gradient-border:before{content:'';position:absolute;inset:0;padding:1px;border-radius:inherit;background:linear-gradient(225deg,rgba(255,255,255,0),rgba(255,255,255,.2),rgba(255,255,255,0));-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.orion-glass-button-wrap{position:relative;z-index:10;display:inline-block;border-radius:999px;background:transparent;pointer-events:none;transition:all 400ms cubic-bezier(.25,1,.5,1)}
@keyframes vidoraGlassFadeIn{from{opacity:0}to{opacity:1}}
@property --vidora-glass-angle-1{syntax:"<angle>";inherits:false;initial-value:-75deg}
@property --vidora-glass-angle-2{syntax:"<angle>";inherits:false;initial-value:-45deg}
.orion-glass-button{all:unset;box-sizing:border-box;position:relative;display:block;min-width:120px;height:60px;border-radius:999px;pointer-events:auto;z-index:30;cursor:pointer;outline:none;background:linear-gradient(-75deg,rgba(255,255,255,.05),rgba(255,255,255,.2),rgba(255,255,255,.05));box-shadow:inset 0 .125em .125em rgba(0,0,0,.05),inset 0 -.125em .125em rgba(255,255,255,.5),0 .25em .125em -.125em rgba(0,0,0,.2),0 0 .1em .25em rgba(255,255,255,.2) inset,0 0 0 0 rgba(255,255,255,1);backdrop-filter:blur(clamp(1px,.125em,4px));-webkit-backdrop-filter:blur(clamp(1px,.125em,4px));transition:all 400ms cubic-bezier(.25,1,.5,1)}
.orion-glass-button:hover{transform:scale(.975);backdrop-filter:blur(.01em);-webkit-backdrop-filter:blur(.01em);box-shadow:inset 0 .125em .125em rgba(0,0,0,.05),inset 0 -.125em .125em rgba(255,255,255,.5),0 .15em .05em -.1em rgba(0,0,0,.25),0 0 .05em .1em rgba(255,255,255,.5) inset,0 0 0 0 rgba(255,255,255,1)}
.orion-glass-button:active{transform:scale(.95) rotate3d(1,0,0,25deg);box-shadow:inset 0 .125em .125em rgba(0,0,0,.05),inset 0 -.125em .125em rgba(255,255,255,.5),0 .125em .125em -.125em rgba(0,0,0,.2),0 0 .1em .25em rgba(255,255,255,.2) inset,0 .225em .05em 0 rgba(0,0,0,.05),0 .25em 0 0 rgba(255,255,255,.75),inset 0 .25em .05em 0 rgba(0,0,0,.15)}
.orion-glass-button:disabled{cursor:not-allowed;opacity:.55;transform:none}
.orion-glass-button-text{position:relative;display:block;z-index:2;user-select:none;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:17px;line-height:1;font-weight:500;letter-spacing:-.025em;color:#262626;padding:14px 24px;text-shadow:0 .25em .05em rgba(0,0,0,.1);transition:all 400ms cubic-bezier(.25,1,.5,1);white-space:nowrap}
.orion-glass-button:hover .orion-glass-button-text{text-shadow:.025em .025em .025em rgba(0,0,0,.12)}
.orion-glass-button:active .orion-glass-button-text{text-shadow:.025em .25em .05em rgba(0,0,0,.12)}
.orion-glass-button::after{content:'';position:absolute;inset:0;border-radius:999px;width:calc(100% + 2px);height:calc(100% + 2px);top:-1px;left:-1px;padding:1px;box-sizing:border-box;background:conic-gradient(from var(--vidora-glass-angle-1) at 50% 50%,rgba(0,0,0,.5),rgba(0,0,0,0) 5% 40%,rgba(0,0,0,.5) 50%,rgba(0,0,0,0) 60% 95%,rgba(0,0,0,.5)),linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,.5));mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;-webkit-mask-composite:xor;transition:all 400ms cubic-bezier(.25,1,.5,1),--vidora-glass-angle-1 500ms ease;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.5);pointer-events:none}
.orion-glass-button:hover::after{--vidora-glass-angle-1:-125deg}
.orion-glass-button:active::after{--vidora-glass-angle-1:-75deg}
.orion-glass-button-shine{position:absolute;inset:0;border-radius:999px;width:calc(100% - 1px);height:calc(100% - 1px);top:.5px;left:.5px;background:linear-gradient(var(--vidora-glass-angle-2),rgba(255,255,255,0) 0%,rgba(255,255,255,.5) 40% 50%,rgba(255,255,255,0) 55%);mix-blend-mode:screen;pointer-events:none;background-size:200% 200%;background-position:0% 50%;background-repeat:no-repeat;transition:background-position 500ms cubic-bezier(.25,1,.5,1),--vidora-glass-angle-2 500ms cubic-bezier(.25,1,.5,1)}
.orion-glass-button:hover .orion-glass-button-shine{background-position:25% 50%}
.orion-glass-button:active .orion-glass-button-shine{background-position:50% 15%;--vidora-glass-angle-2:-15deg}
.orion-glass-button:focus-visible{outline:2px solid rgba(59,130,246,.45);outline-offset:4px}
@media (max-width:768px){.orion-glass-button-text{font-size:17px;padding:14px 24px}}
/* PRIMARY / ACTION BUTTON — supplied CodePen treatment adapted to both VIDORA themes. */.codepen-action-button{position:relative;display:inline-flex;align-items:stretch;justify-content:center;overflow:hidden;cursor:pointer;color:#fff;text-decoration:none;font-family:inherit;font-weight:600;border-radius:100px;padding:2px;isolation:isolate;background:transparent;border:0;min-height:48px;height:48px;min-width:120px;outline:none;transition:transform .3s cubic-bezier(.23,1,.32,1),filter .3s ease,box-shadow .3s ease}.codepen-action-button::before{content:"";position:absolute;inset:0;width:400%;height:100%;background:linear-gradient(115deg,#d1d1d1,#02367b,#a7bfde);background-size:25% 100%;animation:border-shift .75s linear infinite;border-radius:100px;z-index:0}.codepen-action-inner{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;height:100%;padding:1rem 1.5rem;font-size:12px;line-height:1;background:#02367b;border-radius:100px;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 8px 22px rgba(2,54,123,.16);transition:background .3s ease,box-shadow .3s ease,transform .3s ease}.codepen-action-button:hover{transform:translateY(-2px);filter:brightness(1.04)}.codepen-action-button:hover .codepen-action-inner{background:#0b4c91;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 14px 30px rgba(2,54,123,.25)}.codepen-action-button:active{transform:translateY(-1px) scale(.985)}.codepen-action-button:disabled{opacity:.45;cursor:not-allowed;transform:none;filter:none}.codepen-action-button:focus-visible{outline:2px solid rgba(59,130,246,.55);outline-offset:3px}.codepen-action-icon{transition:transform .3s ease}.codepen-action-button:hover .codepen-action-icon{transform:translateX(2px)}.codepen-action-dark::before{background:linear-gradient(115deg,#d1d1d1,#02367b,#a7bfde);background-size:25% 100%}.codepen-action-light::before{background:linear-gradient(115deg,#d1d1d1,#02367b,#a7bfde);background-size:25% 100%}.codepen-action-light .codepen-action-inner{background:#02367b}.codepen-action-light:hover .codepen-action-inner{background:#0b4c91}@keyframes border-shift{to{transform:translateX(-25%)}}
/* SECONDARY BUTTON — supplied blue glass treatment adapted to both themes. */.secondary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;min-width:120px;padding:12px 28px;border-radius:999px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;line-height:1;transition:all .3s cubic-bezier(.23,1,.32,1);outline:none}.secondary-button-icon{transition:transform .3s ease}.secondary-button:hover .secondary-button-icon{transform:translateX(2px)}.secondary-button:focus-visible{outline:2px solid rgba(59,130,246,.55);outline-offset:3px}.secondary-button:active{transform:translateY(0) scale(.985)}.secondary-button:disabled{opacity:.45;cursor:not-allowed;transform:none}.secondary-button-dark{color:#fff;background:#172554;border:1px solid #2563eb;box-shadow:0 10px 28px rgba(30,64,175,.15),inset 0 1px 0 rgba(255,255,255,.06)}.secondary-button-dark:hover{background:#1d4ed8;border-color:#93c5fd;box-shadow:0 0 40px rgba(0,123,255,.55),0 15px 34px rgba(30,64,175,.2)}.secondary-button-light{color:#fff;background:#1e3a8a;border:1px solid #3b82f6;box-shadow:0 10px 28px rgba(37,99,235,.12),inset 0 1px 0 rgba(255,255,255,.18)}.secondary-button-light:hover{background:#2563eb;border-color:#93c5fd;box-shadow:0 0 40px rgba(0,123,255,.4),0 15px 34px rgba(37,99,235,.16)}
.theme-badge-dark,.theme-badge-light{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.2em}.theme-badge-dark{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#cbd5e1}.theme-badge-light{border:1px solid rgba(255,255,255,.82);background:rgba(255,255,255,.68);color:#64748b;box-shadow:0 8px 26px rgba(15,23,42,.04),inset 0 1px 0 rgba(255,255,255,.9)}
.theme-step-dark,.theme-step-light{border-radius:16px;border:1px solid;padding:14px 16px;transition:transform .35s ease,box-shadow .35s ease}.theme-step-dark{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.03)}.theme-step-light{border-color:rgba(255,255,255,.8);background:rgba(255,255,255,.52);box-shadow:0 8px 22px rgba(15,23,42,.025)}.theme-step-dark:hover,.theme-step-light:hover{transform:translateY(-2px)}.theme-step-number{font-size:9px;font-weight:700;letter-spacing:.16em;color:#94a3b8}.theme-step-title{margin-top:8px;font-size:12px;font-weight:600}.theme-step-dark .theme-step-title{color:#e2e8f0}.theme-step-light .theme-step-title{color:#334155}
.showcase-card{width:340px;flex-shrink:0;overflow:hidden;border-radius:28px;transition:transform .6s cubic-bezier(.23,1,.32,1)}.showcase-card:hover{transform:translateY(-8px)}.showcase-card-dark{background:rgba(24,24,27,.55);box-shadow:0 20px 60px rgba(0,0,0,.28)}.showcase-card-light{background:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.78);box-shadow:0 16px 50px rgba(15,23,42,.055),inset 0 1px 0 rgba(255,255,255,.8)}.vidora-marquee{overflow:hidden;mask-image:linear-gradient(to right,transparent,black 5%,black 95%,transparent);-webkit-mask-image:linear-gradient(to right,transparent,black 5%,black 95%,transparent)}.vidora-marquee-track{display:flex;width:max-content;gap:16px;animation:vidoraMarquee 34s linear infinite;will-change:transform;transform:translate3d(0,0,0)}.showcase-card{contain:layout paint style}.vidora-marquee:hover .vidora-marquee-track{animation-play-state:paused}
.trusted-sites-shell{position:relative;overflow:hidden;border:1px solid;border-radius:28px;padding:10px 0;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}.trusted-sites-dark{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.02);box-shadow:0 20px 60px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.04)}.trusted-sites-light{border-color:rgba(255,255,255,.76);background:rgba(255,255,255,.4);box-shadow:0 18px 50px rgba(15,23,42,.05),inset 0 1px 0 rgba(255,255,255,.85)}.trusted-sites-mask{overflow:hidden;mask-image:linear-gradient(90deg,transparent,black 8%,black 92%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,black 8%,black 92%,transparent)}.trusted-sites-track{display:flex;width:max-content;gap:14px;padding:6px 14px;animation:trustedSitesScroll 32s linear infinite;will-change:transform}.trusted-sites-shell:hover .trusted-sites-track{animation-play-state:paused}.trusted-site-card{min-width:190px;display:flex;align-items:center;gap:12px;padding:13px 16px;border:1px solid;border-radius:18px;transition:transform .45s cubic-bezier(.23,1,.32,1),box-shadow .45s ease,background .45s ease}.trusted-site-card:hover{transform:translateY(-3px)}.trusted-sites-dark .trusted-site-card{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:#cbd5e1}.trusted-sites-dark .trusted-site-card:hover{background:rgba(255,255,255,.07);color:#fff;box-shadow:0 12px 28px rgba(0,0,0,.22),0 0 24px rgba(34,211,238,.05)}.trusted-sites-light .trusted-site-card{border-color:rgba(255,255,255,.75);background:rgba(255,255,255,.7);color:#64748b;box-shadow:0 6px 18px rgba(15,23,42,.025)}.trusted-sites-light .trusted-site-card:hover{background:rgba(255,255,255,.94);color:#1e293b;box-shadow:0 12px 28px rgba(15,23,42,.06)}.trusted-site-icon{width:40px;height:40px;flex:none;display:grid;place-items:center;border:1px solid;border-radius:13px}.trusted-sites-dark .trusted-site-icon{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.04)}.trusted-sites-light .trusted-site-icon{border-color:rgba(226,232,240,.8);background:rgba(255,255,255,.7)}.trusted-site-icon svg{width:21px;height:21px}.trusted-site-card span{font-size:12px;font-weight:650;letter-spacing:-.01em}.trusted-sites-glow{position:absolute;top:0;bottom:0;width:90px;pointer-events:none;z-index:4}.trusted-sites-glow-left{left:0;background:linear-gradient(90deg,rgba(0,0,0,.12),transparent)}.trusted-sites-glow-right{right:0;background:linear-gradient(270deg,rgba(0,0,0,.12),transparent)}.trusted-sites-light .trusted-sites-glow-left{background:linear-gradient(90deg,rgba(247,249,250,.84),transparent)}.trusted-sites-light .trusted-sites-glow-right{background:linear-gradient(270deg,rgba(247,249,250,.84),transparent)}
.quality-tile{border-radius:22px;border:1px solid;padding:16px;text-align:left;transition:all .45s cubic-bezier(.34,1.56,.64,1)}.quality-tile:hover{transform:translateY(-5px)}.quality-dark{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:#fff}.quality-dark:hover{background:rgba(255,255,255,.06);border-color:rgba(34,211,238,.2)}.quality-light-orion{border-color:rgba(255,255,255,.78);background:rgba(255,255,255,.52);color:#334155;box-shadow:0 8px 22px rgba(15,23,42,.025)}.quality-light-orion:hover{background:rgba(255,255,255,.82);border-color:rgba(59,130,246,.35);box-shadow:0 14px 32px rgba(15,23,42,.06)}
.orion-hero{position:relative;overflow:hidden}.orion-hero-bg-shape{position:absolute;left:-130px;top:-130px;width:460px;height:460px;border-radius:9999px;background:radial-gradient(circle,rgba(96,165,250,.18),transparent 68%);filter:blur(45px);pointer-events:none}.orion-hero-visual{position:relative;height:580px;display:flex;align-items:center;justify-content:center;perspective:1400px}.orion-hero-glow{position:absolute;width:430px;height:430px;border-radius:9999px;background:radial-gradient(circle,rgba(59,130,246,.12),transparent 68%);filter:blur(55px)}.orion-device{position:relative;width:340px;height:560px;animation:orionDeviceFloat 6s ease-in-out infinite;transition:transform .8s cubic-bezier(.23,1,.32,1)}.orion-device:hover{transform:translateY(-5px) rotateY(-4deg) scale(1.01)}.orion-device-side,.orion-device-right{position:absolute;z-index:1;background:#e2e8f0;border:1px solid rgba(255,255,255,.9);box-shadow:inset 2px 2px 4px rgba(255,255,255,.95),inset -2px -2px 4px rgba(15,23,42,.14)}.orion-device-side{left:-9px;width:9px;border-right:0;border-radius:8px 0 0 8px}.orion-device-button-a{top:120px;height:28px}.orion-device-button-b{top:174px;height:56px}.orion-device-button-c{top:242px;height:56px}.orion-device-right{right:-9px;top:188px;width:9px;height:78px;border-left:0;border-radius:0 8px 8px 0}.orion-device-body{position:absolute;inset:0;z-index:2;border-radius:3.9rem;background:#e2e8f0;border:5px solid #f1f5f9;box-shadow:25px 35px 65px rgba(15,23,42,.15),inset -6px -6px 16px rgba(15,23,42,.08),inset 6px 6px 16px rgba(255,255,255,.95)}.orion-device-screen{position:absolute;inset:10px;overflow:hidden;border-radius:3.25rem;background:#f8f9fb;border:1px solid rgba(203,213,225,.7);box-shadow:inset 0 0 20px rgba(15,23,42,.06)}.orion-dynamic-island{position:absolute;top:12px;left:50%;z-index:20;width:116px;height:30px;transform:translateX(-50%);display:flex;align-items:center;justify-content:space-between;padding:0 10px;border-radius:999px;background:#0f172a;box-shadow:inset 0 -2px 4px rgba(255,255,255,.08),0 4px 10px rgba(0,0,0,.12);transition:width .5s}.orion-dynamic-island:hover{width:126px}.orion-dynamic-island span{width:12px;height:12px;border-radius:50%;background:#1e293b;border:1px solid rgba(255,255,255,.05)}.orion-dynamic-island i{width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 5px rgba(16,185,129,.6);animation:orionPulse 2s ease-in-out infinite}.orion-status-bar{height:56px;padding:12px 24px 0;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:10;color:#0f172a;font-size:11px;font-weight:700;background:linear-gradient(to bottom,#f8f9fb,transparent)}.orion-status-bar>div{display:flex;align-items:center;gap:6px}.orion-battery{position:relative;width:18px;height:9px;border:1.5px solid #0f172a;border-radius:3px;padding:1px}.orion-battery:after{content:'';position:absolute;top:2px;right:-3px;width:2px;height:4px;background:#0f172a;border-radius:0 2px 2px 0}.orion-battery span{display:block;height:100%;width:75%;border-radius:1px;background:#0f172a}.orion-screen-content{position:relative;z-index:5;height:calc(100% - 56px);overflow:hidden;padding:8px 16px 32px;display:flex;flex-direction:column;gap:12px;background:linear-gradient(135deg,#f8f9fb,rgba(226,232,240,.3))}.orion-screen-heading{display:flex;flex-direction:column;margin:2px 0 2px 4px}.orion-screen-heading strong{font-size:22px;line-height:1;letter-spacing:-.045em;color:#1e293b;font-weight:600}.orion-screen-heading span{margin-top:6px;font-size:10px;font-weight:500;color:#64748b}.orion-mini-card{background:rgba(255,255,255,.9);border:1px solid rgba(226,232,240,.9);border-radius:17px;box-shadow:0 4px 12px rgba(15,23,42,.035),inset 0 1px 2px rgba(255,255,255,1);backdrop-filter:blur(14px);transition:transform .5s cubic-bezier(.23,1,.32,1),box-shadow .5s}.orion-mini-card:hover{transform:translateY(-4px);box-shadow:0 12px 24px rgba(15,23,42,.08)}.orion-uptime-card{padding:16px;display:flex;align-items:center;justify-content:space-between}.orion-mini-label{display:block;font-size:9px;font-weight:700;letter-spacing:.16em;color:#94a3b8;text-transform:uppercase}.orion-uptime-card strong{display:block;margin-top:5px;font-size:30px;letter-spacing:-.05em;color:#1e293b}.orion-uptime-card strong span{font-size:16px;color:#94a3b8;margin-left:2px}.orion-ring{position:relative;width:60px;height:60px;display:grid;place-items:center}.orion-ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);transition:transform 1s}.orion-uptime-card:hover .orion-ring svg{transform:rotate(270deg)}.orion-ring>div{width:32px;height:32px;border-radius:999px;background:#eff6ff;border:1px solid #dbeafe;display:grid;place-items:center;color:#3b82f6}.orion-chart-card{height:160px;padding:16px;display:flex;flex-direction:column;position:relative;overflow:hidden}.orion-mini-card-top{display:flex;justify-content:space-between;align-items:center;z-index:2}.orion-response-heading{display:flex;align-items:center;gap:6px}.orion-response-heading i{width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 5px rgba(16,185,129,.4);animation:orionPulse 2s ease-in-out infinite}.orion-response-heading span{font-size:9px;font-weight:700;color:#94a3b8;letter-spacing:.14em}.orion-response-value{font-size:14px;font-weight:700;color:#1e293b}.orion-response-value span{font-size:9px;font-weight:500;color:#94a3b8;margin-left:2px}.orion-bars{display:flex;align-items:flex-end;gap:3px;flex:1;padding-top:10px;position:relative;z-index:2}.orion-bars span{flex:1;border-radius:3px 3px 0 0;background:rgba(59,130,246,.16);transform-origin:bottom;animation:orionBars 2.6s ease-in-out infinite}.orion-bars span:nth-child(5){background:rgba(59,130,246,.36)}.orion-bars span:nth-child(6){background:rgba(16,185,129,.62);box-shadow:0 0 8px rgba(16,185,129,.2)}.orion-chart-card:after{content:'';position:absolute;inset:0;background:linear-gradient(rgba(241,245,249,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(241,245,249,.6) 1px,transparent 1px);background-size:14px 14px;opacity:.5}.orion-action-card{min-height:92px;padding:14px;display:flex;align-items:center;gap:10px}.orion-action-icon{width:30px;height:30px;display:grid;place-items:center;border-radius:999px;background:#f5f3ff;border:1px solid #ede9fe;color:#8b5cf6}.orion-action-card>div:nth-child(2){flex:1}.orion-action-card strong{display:block;font-size:10px;color:#334155}.orion-action-card span{display:block;margin-top:3px;font-size:9px;color:#8b5cf6;font-weight:600}.orion-toggle{width:32px;height:18px;border-radius:999px;background:#8b5cf6;position:relative;box-shadow:inset 0 1px 3px rgba(0,0,0,.12)}.orion-toggle span{position:absolute;right:2px;top:2px;width:14px;height:14px;border-radius:50%;background:white;box-shadow:0 1px 3px rgba(0,0,0,.1)}.orion-home-indicator{position:absolute;left:50%;bottom:9px;width:124px;height:4px;transform:translateX(-50%);background:rgba(15,23,42,.1);border-radius:999px;transition:.3s}.orion-home-indicator:hover{background:rgba(15,23,42,.2);transform:translateX(-50%) scaleX(1.05)}
.cancel-button{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:11px 15px;font-size:12px;font-weight:600;transition:.3s}.cancel-dark{color:#fca5a5;background:rgba(244,63,94,.06);border:1px solid rgba(244,63,94,.15)}.cancel-light{color:#be123c;background:rgba(244,63,94,.05);border:1px solid rgba(244,63,94,.14)}.cancel-button:hover{transform:translateY(-1px)}
.theme-switch{width:36px;height:36px;border-radius:999px;border:1px solid;display:grid;place-items:center;transition:.3s}.theme-switch-dark{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#67e8f9}.theme-switch-light{border-color:rgba(255,255,255,.8);background:rgba(255,255,255,.6);color:#475569}.theme-switch:hover{transform:translateY(-1px)}
@media (max-width:900px){.showcase-card{width:300px}.orion-device{transform:scale(.86)}.orion-device:hover{transform:translateY(-5px) rotateY(-3deg) scale(.88)}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}

.auth-status-pulse{animation:authStatusPulse 2.2s ease-in-out infinite}
@keyframes authStatusPulse{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.0)}50%{box-shadow:0 0 0 7px rgba(52,211,153,.05)}}

`