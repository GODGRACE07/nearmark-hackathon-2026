import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, Copy, ExternalLink, Fingerprint, KeyRound, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api, post, shorten, copyText } from '../lib/api';
import { PageIntro, Panel, StateTag } from '../components/Chrome';

type Inspection = any;
export default function Inspector() {
  const [accountId, setAccountId] = useState(localStorage.getItem('nearmark:last-account') || '');
  const [agentPublicKey, setAgentPublicKey] = useState('');
  const [data, setData] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showKeys, setShowKeys] = useState(true);
  const [copied, setCopied] = useState(false);
  const run = async (event?: FormEvent) => {
    event?.preventDefault(); setError(''); setLoading(true); setData(null);
    try {
      const result = await post<Inspection>('/api/inspect', { accountId: accountId.trim(), agentPublicKey: agentPublicKey.trim() || undefined });
      setData(result); localStorage.setItem('nearmark:last-account', accountId.trim());
    } catch (e:any) { setError(e.message || 'Inspection failed.'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ if (accountId && !data) { /* User starts the live read explicitly. */ } }, [accountId, data]);
  const share = async () => { if (!data) return; await copyText(`${window.location.origin}/passport/${encodeURIComponent(data.accountId)}`); setCopied(true); setTimeout(()=>setCopied(false),1600); };
  return <>
    <PageIntro eyebrow="AUTHORITY INTELLIGENCE / 01" title="Wallet X-Ray" description="Inspect public NEAR account state and see the permissions registered on-chain. Add the agent's public key to attribute the assessment to that specific key." action={<a href="https://docs.near.org/api/rpc/access-keys" target="_blank" rel="noreferrer" className="button button-outline">Access-key docs <ExternalLink size={14}/></a>}/>
    <Panel title="Start an account inspection" subtitle="Read-only. No wallet connection or private key is required.">
      <form className="form-grid inspect-form" onSubmit={run}>
        <label className="field field-wide"><span>NEAR ACCOUNT ID</span><input value={accountId} onChange={e=>setAccountId(e.target.value)} placeholder="account.near" required minLength={2} maxLength={64} autoComplete="off"/><small>Named account or 64-character implicit account.</small></label>
        <label className="field field-wide"><span>AGENT PUBLIC KEY <em>OPTIONAL, RECOMMENDED</em></span><input value={agentPublicKey} onChange={e=>setAgentPublicKey(e.target.value)} placeholder="ed25519:..." autoComplete="off"/><small>Without this, Nearmark reports account-level permissions and does not attribute a key to an agent.</small></label>
        <div className="form-actions"><button className="button button-lime" type="submit" disabled={loading || !accountId.trim()}>{loading?<><span className="button-spinner"/>Inspecting live state</>:<>Inspect account <ArrowUpRight size={15}/></>}</button><span className="form-meta"><i/> NEAR finalized state + FastNear indexed history</span></div>
      </form>
      {error && <div className="inline-alert error-alert"><ShieldAlert size={16}/><span>{error}</span></div>}
    </Panel>
    <AnimatePresence>{data && <motion.div className="result-stack" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.35}}>
      <div className="result-header"><div><div className="eyebrow">INSPECTION COMPLETE / {data.network?.toUpperCase()}</div><h2>{data.accountId}</h2><p>Inspected {new Date(data.inspectedAt).toLocaleString()} · block {data.blockHeight?.toLocaleString() || 'unknown'}</p></div><div className="result-actions"><button className="button button-outline button-small" onClick={share}><Copy size={14}/>{copied?'Copied passport link':'Share passport'}</button><Link to={`/passport/${encodeURIComponent(data.accountId)}`} className="button button-light button-small">Open passport <ArrowUpRight size={14}/></Link></div></div>
      <div className="metric-grid result-metrics"><div className="metric-card"><div className="metric-top"><span>ACCOUNT CODE</span><Fingerprint size={15}/></div><strong>{data.hasContract?'Contract':'No contract'}</strong><small className="mono-cell">{shorten(data.codeHash,12,8)}</small></div><div className="metric-card"><div className="metric-top"><span>REGISTERED KEYS</span><KeyRound size={15}/></div><strong>{data.keys?.length ?? 0}</strong><small>{data.keyAssessment?.fullAccessCount ?? 0} Full Access · {data.keyAssessment?.functionCallCount ?? 0} FunctionCall</small></div><div className="metric-card"><div className="metric-top"><span>INDEXED ACTIVITY</span><RefreshCw size={15}/></div><strong>{data.history?.sampled ?? 0}</strong><small>{data.history?.available?'Recent rows returned':'History unavailable'}</small></div><div className="metric-card metric-card-dark"><div className="metric-top"><span>PERMISSION EXPOSURE</span><ShieldCheck size={15}/></div><strong>{data.keyAssessment?.exposure || 'UNKNOWN'}</strong><small>{data.keyAssessment?.scope==='agent-key'?'Specific agent key selected':'Account-level only'}</small></div></div>
      <Panel title="Agent authority assessment" subtitle={data.keyAssessment?.summary} action={<StateTag state={data.keyAssessment?.exposure || 'UNKNOWN'}/> }>
        {data.keyAssessment?.scope==='agent-key' ? <div className="assessment-grade"><div className={`grade-number stage-${data.keyAssessment.provisionalStage ?? 'unknown'}`}>{data.keyAssessment.provisionalStage ?? '—'}</div><div><strong>{data.keyAssessment.provisionalStage===0?'Critical direct authority':data.keyAssessment.provisionalStage===1?'Broad method authority':data.keyAssessment.provisionalStage===2?'Scoped direct authority':'Not graded'}</strong><p>This is a provisional permission classification only. A complete security stage requires reproducible behavioural tests and verified recovery controls.</p></div></div> : <div className="inline-alert warn-alert"><ShieldAlert size={16}/><span>Select the agent's exact public key above to attribute a security assessment. Account-level keys may belong to owners, operators or other applications.</span></div>}
      </Panel>
      <Panel title="Access-key inventory" subtitle="Permissions returned by NEAR RPC at the inspected finalized block." action={<button className="text-button" onClick={()=>setShowKeys(v=>!v)}>{showKeys?'Collapse':'Expand'} <ChevronDown size={14}/></button>}>
        {showKeys && (data.keys?.length ? <div className="key-list">{data.keys.map((key:any,index:number)=><div className="key-card" key={key.publicKey || index}><div className="key-card-top"><div><span className="key-index">KEY {String(index+1).padStart(2,'0')}</span><strong>{key.kind}</strong></div><StateTag state={key.kind==='FullAccess'?'Critical authority':key.unrestrictedMethods?'Unrestricted methods':'Scoped methods'}/></div><div className="key-public"><code>{key.publicKey}</code><button className="icon-button" onClick={()=>copyText(key.publicKey)} aria-label="Copy public key"><Copy size={14}/></button></div>{key.kind==='FunctionCall' && <div className="key-properties"><div><span>RECEIVER</span><strong>{key.receiverId || 'Unknown'}</strong></div><div><span>METHODS</span><strong>{key.methodNames?.length ? key.methodNames.join(', ') : 'All methods'}</strong></div><div><span>GAS ALLOWANCE</span><strong>{key.allowanceNear ? `${key.allowanceNear} NEAR` : 'Not set / unlimited'}</strong></div></div>}</div>)}</div> : <div className="empty-state compact"><strong>No keys returned</strong><span>RPC returned an empty access-key list.</span></div>)}
      </Panel>
      <Panel title="Authority Shadow" subtitle="Direct key scope is confirmed by NEAR RPC. Downstream effects are shown only when the on-chain code hash and Gate agent binding match the local NEARMARK source.">
        {!data.authorityShadow ? <div className="inline-alert warn-alert"><ShieldAlert size={16}/><span>Authority Shadow is unavailable from this API deployment. Downstream effects remain unknown.</span></div> : <>
          <div className="assessment-grade"><div className="grade-number stage-2">{data.authorityShadow.downstreamAuthority?.filter((e:any)=>e.status==='CODE_HASH_AND_AGENT_BINDING_CONFIRMED').length || 0}</div><div><strong>{data.authorityShadow.summary}</strong><p>{data.authorityShadow.disclaimer}</p></div></div>
          {(data.authorityShadow.downstreamAuthority || []).map((edge:any,index:number)=><div className="key-card" key={`${edge.receiver}-${index}`}><div className="key-card-top"><div><span className="key-index">CONTRACT PATH {String(index+1).padStart(2,'0')}</span><strong>{edge.contract || edge.receiver}</strong></div><StateTag state={edge.status}/></div><p className="mono-cell">{edge.receiver} · {(edge.methods || []).join(', ') || 'all methods'}</p>{Array.isArray(edge.downstreamEffects) ? <ul className="limitation-list">{edge.downstreamEffects.map((v:string,j:number)=><li key={j}>{v}</li>)}</ul> : <p>{edge.downstreamEffects}</p>}{edge.controls?.length ? <><strong>Enforced controls</strong><ul className="limitation-list">{edge.controls.map((v:string,j:number)=><li key={j}>{v}</li>)}</ul></> : null}{edge.evidence?.map((e:any,j:number)=><div className="inline-alert" key={j}><StateTag state={e.label}/><span>{e.detail}</span></div>)}</div>)}
        </>}
      </Panel>
      <Panel title="Recent indexed activity" subtitle="FastNear account history sample. This is not a complete forensic trace.">
        {!data.history?.available ? <div className="inline-alert warn-alert"><ShieldAlert size={16}/><span>{data.history?.error || 'History source unavailable.'}</span></div> : data.history.transactions?.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>TRANSACTION</th><th>BLOCK</th><th>ROLE</th><th>SUCCESS</th></tr></thead><tbody>{data.history.transactions.slice(0,12).map((tx:any,i:number)=><tr key={`${tx.hash}-${i}`}><td className="mono-cell">{shorten(tx.hash,12,7)}</td><td>{tx.blockHeight?.toLocaleString() || '—'}</td><td>{tx.isSigner?'Signer':tx.isReceiver?'Receiver':'Indexed'}</td><td><StateTag state={tx.success===true?'Success':tx.success===false?'Failed':'Unknown'}/></td></tr>)}</tbody></table></div> : <div className="empty-state compact"><strong>No indexed transactions returned</strong><span>Absence of a sample is not proof that the account has never been active.</span></div>}
      </Panel>
      <Panel title="Evidence limitations" subtitle="Nearmark deliberately avoids claims that public RPC cannot support."><ul className="limitation-list">{data.limitations?.map((text:string,i:number)=><li key={i}>{text}</li>)}</ul></Panel>
    </motion.div>}</AnimatePresence>
  </>;
}
