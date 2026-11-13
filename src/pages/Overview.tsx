import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, Cpu, Fingerprint, GitBranch, ShieldAlert, ShieldCheck, Terminal, Waves } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { PageIntro, Panel, StateTag } from '../components/Chrome';

type Health = { ok: boolean; network: string; integrations: Record<string,string> };
export default function Overview() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState('');
  const [runs, setRuns] = useState<any[]>([]);
  useEffect(() => {
    api<Health>('/api/health').then(setHealth).catch(e => setHealthError(e.message));
    api<{runs:any[]}>('/api/benchmark/runs').then(d=>setRuns(d.runs || [])).catch(()=>setRuns([]));
  }, []);
  const account = localStorage.getItem('nearmark:last-account');
  const integrationRows = [
    ['NEAR RPC', health?.integrations?.nearRpc || 'checking'],
    ['FastNear history', health?.integrations?.fastNear || 'checking'],
    ['NEAR AI Cloud', health?.integrations?.nearAiCloud || 'checking'],
    ['OutLayer', health?.integrations?.outLayer || 'checking'],
  ];
  return <>
    <PageIntro eyebrow="SECURITY WORKSPACE / OVERVIEW" title="Good to see you." description="A live workspace for inspecting NEAR agent authority, evaluating counterparties and running reproducible security tests." action={<Link to="/inspect" className="button button-lime">New inspection <ArrowUpRight size={15}/></Link>}/>
    <div className="notice-banner"><div className="notice-icon"><Waves size={17}/></div><div><strong>Read-only mode is active</strong><span>Nearmark reads public NEAR state and runs local benchmark tests. It does not connect a wallet, sign transactions or move funds.</span></div><span className="notice-tag">SAFE BY DEFAULT</span></div>
    <div className="metric-grid">
      <motion.div className="metric-card" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.04}}><div className="metric-top"><span>NETWORK</span><Activity size={16}/></div><strong>{health?.network === 'testnet' ? 'Testnet' : 'Mainnet'}</strong><small><i className={health?.integrations?.nearRpc==='connected'?'green-dot':'amber-dot'}/> {health?.integrations?.nearRpc || (healthError?'API offline':'checking RPC')}</small></motion.div>
      <motion.div className="metric-card" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.1}}><div className="metric-top"><span>BENCHMARK RUNS</span><GitBranch size={16}/></div><strong>{runs.length}</strong><small>Saved local test reports</small></motion.div>
      <motion.div className="metric-card" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.16}}><div className="metric-top"><span>LAST INSPECTED</span><Fingerprint size={16}/></div><strong className="metric-account">{account || 'No account yet'}</strong><small>{account?'Stored in this browser':'Start with a public NEAR ID'}</small></motion.div>
      <motion.div className="metric-card metric-card-dark" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.22}}><div className="metric-top"><span>SECURITY POSTURE</span><ShieldCheck size={16}/></div><strong>Evidence first</strong><small>Unknown stays unknown. No fake green checks.</small></motion.div>
    </div>
    <div className="dashboard-grid">
      <Panel title="Start an investigation" subtitle="Choose a task to begin. All account inspections are read-only.">
        <div className="action-list">
          <Link to="/inspect" className="action-row"><div className="action-icon lime-icon"><Fingerprint size={18}/></div><div><strong>Inspect wallet authority</strong><small>Review access keys, contract state and indexed activity.</small></div><ArrowUpRight size={16}/></Link>
          <Link to="/counterparty" className="action-row"><div className="action-icon coral-icon"><ShieldAlert size={18}/></div><div><strong>Check a counterparty</strong><small>Evaluate a proposed NEAR payment against an owner mandate.</small></div><ArrowUpRight size={16}/></Link>
          <Link to="/lab" className="action-row"><div className="action-icon violet-icon"><Cpu size={18}/></div><div><strong>Run the Attack Lab</strong><small>Execute the deterministic recipient and permit test suite.</small></div><ArrowUpRight size={16}/></Link>
        </div>
      </Panel>
      <Panel title="Integration health" subtitle="Live configuration detected by the local API" action={<Link to="/developers" className="panel-link">Configure <ArrowUpRight size={13}/></Link>}>
        <div className="integration-list">{integrationRows.map(([name,state])=><div className="integration-row" key={name}><span className="integration-mark">{name==='NEAR RPC'?'N':name==='FastNear history'?'F':name==='NEAR AI Cloud'?'AI':'OL'}</span><span>{name}</span><StateTag state={state}/></div>)}</div>
        <p className="helper-note">NEAR RPC and FastNear can work without private credentials. NEAR AI and OutLayer require your own server-side API keys or project setup.</p>
      </Panel>
    </div>
    <Panel title="Recent benchmark runs" subtitle="Actual results returned by the local test harness." action={<Link to="/benchmarks" className="panel-link">All benchmarks <ArrowUpRight size={13}/></Link>}>
      {runs.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>RUN ID</th><th>PROFILE</th><th>RESULT</th><th>COMPLETED</th></tr></thead><tbody>{runs.slice(0,5).map(run=><tr key={run.id}><td className="mono-cell">{run.id}</td><td>{run.profile}</td><td><StateTag state={`${run.summary?.passed}/${run.summary?.total} passed`}/></td><td>{new Date(run.completedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <div className="empty-state"><div className="empty-icon"><Activity/></div><strong>No benchmark runs yet</strong><span>Run the core suite to create your first signed local test receipt.</span><Link to="/lab" className="button button-outline button-small">Open Attack Lab <ArrowUpRight size={14}/></Link></div>}
    </Panel>
    <div className="page-footnote"><span>NEARMARK / 0.1.0</span><span>Public-chain data is point-in-time evidence, not a safety guarantee.</span><Link to="/methodology">Read limitations <ArrowUpRight size={12}/></Link></div>
  </>;
}
