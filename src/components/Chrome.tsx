import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Activity, ArrowUpRight, BookOpen, ChevronDown, Command, Crosshair, Gauge, Menu, Search, Shield, ShieldCheck, Terminal, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const navItems = [
  { to: '/app', label: 'Overview', icon: Gauge },
  { to: '/inspect', label: 'Authority X-Ray', icon: Search },
  { to: '/counterparty', label: 'Counterparty check', icon: ShieldCheck },
  { to: '/lab', label: 'Attack laboratory', icon: Crosshair },
  { to: '/benchmarks', label: 'Benchmarks', icon: Activity },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return <header className="marketing-nav">
    <Link to="/" className="brand-lockup" aria-label="Nearmark home"><span className="brand-symbol"><span/></span><span>nearmark<span className="brand-dot">.</span></span></Link>
    <nav className="marketing-links">
      <a href="/#why">Why Nearmark</a><a href="/#how">How it works</a><Link to="/benchmarks">Benchmark</Link><Link to="/developers">Developers</Link>
    </nav>
    <div className="nav-actions"><Link className="nav-text-link" to="/methodology">Methodology <ArrowUpRight size={14}/></Link><Link className="button button-small button-light" to="/app">Open console <ArrowUpRight size={14}/></Link></div>
    <button className="mobile-menu-button" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">{open ? <X/> : <Menu/>}</button>
    <AnimatePresence>{open && <motion.div className="mobile-menu" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}><a href="/#why" onClick={()=>setOpen(false)}>Why Nearmark</a><a href="/#how" onClick={()=>setOpen(false)}>How it works</a><Link to="/benchmarks" onClick={()=>setOpen(false)}>Benchmark</Link><Link to="/developers" onClick={()=>setOpen(false)}>Developers</Link><Link className="button button-light" to="/app" onClick={()=>setOpen(false)}>Open console <ArrowUpRight size={14}/></Link></motion.div>}</AnimatePresence>
  </header>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="console-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <Link to="/" className="brand-lockup sidebar-brand"><span className="brand-symbol"><span/></span><span>nearmark<span className="brand-dot">.</span></span></Link>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="sidebar-nav">{navItems.map(item => { const Icon = item.icon; return <NavLink key={item.to} to={item.to} onClick={()=>setMobileOpen(false)} className={({isActive})=>`side-link ${isActive?'active':''}`}><Icon size={17}/><span>{item.label}</span>{item.to==='/lab' && <span className="side-live-dot"/>}</NavLink>; })}</nav>
      <div className="sidebar-label sidebar-label-spaced">RESOURCES</div>
      <nav className="sidebar-nav">
        <NavLink to="/developers" className={({isActive})=>`side-link ${isActive?'active':''}`}><Terminal size={17}/><span>SDK & API</span></NavLink>
        <NavLink to="/methodology" className={({isActive})=>`side-link ${isActive?'active':''}`}><BookOpen size={17}/><span>Methodology</span></NavLink>
      </nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-card"><div className="sidebar-card-icon"><Zap size={15}/></div><div><strong>Built for NEAR</strong><p>Evidence first. No trust required.</p></div><a href="https://near.org" target="_blank" rel="noreferrer" aria-label="NEAR website"><ArrowUpRight size={14}/></a></div>
      <div className="sidebar-bottom"><span className="status-dot"/> Public RPC · read-only <span className="version-tag">v0.1</span></div>
    </aside>
    <div className="console-main">
      <div className="console-topbar"><button className="mobile-sidebar-toggle" onClick={()=>setMobileOpen(v=>!v)} aria-label="Toggle sidebar"><Menu size={19}/></button><div className="breadcrumb"><span>NEARMARK</span><span className="crumb-slash">/</span><span className="crumb-current">Security workspace</span></div><div className="topbar-right"><span className="network-indicator"><i/> NEAR Mainnet</span><a className="icon-button" href="https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/06-security.md" target="_blank" rel="noreferrer" aria-label="Track specification"><ArrowUpRight size={16}/></a><Link to="/developers" className="topbar-help">API docs <ArrowUpRight size={13}/></Link></div></div>
      <main className="console-content">{children}</main>
    </div>
  </div>;
}

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow"><span className="eyebrow-mark"/>{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-intro-action">{action}</div>}</div>;
}

export function Panel({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}

export function StateTag({ state }: { state: string }) {
  const normalized = state.toLowerCase();
  const cls = normalized.includes('allow') || normalized.includes('connected') || normalized.includes('pass') || normalized.includes('verified') ? 'good' : normalized.includes('block') || normalized.includes('critical') || normalized.includes('failed') || normalized.includes('error') ? 'bad' : normalized.includes('warn') || normalized.includes('pending') || normalized.includes('unknown') || normalized.includes('not') ? 'warn' : 'neutral';
  return <span className={`state-tag ${cls}`}><i/>{state}</span>;
}

export function InlineCode({ children }: { children: ReactNode }) { return <code className="inline-code">{children}</code>; }
