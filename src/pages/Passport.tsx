import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowUpRight, Copy, Fingerprint, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api, post, copyText, shorten } from '../lib/api';
import { PageIntro, Panel, StateTag } from '../components/Chrome';

export default function Passport() {
  const { account = '' } = useParams();
  const decoded = decodeURIComponent(account);
  const [data,setData] = useState<any>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  useEffect(()=>{let active=true;setLoading(true);post<any>('/api/inspect',{accountId:decoded}).then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[decoded]);
  const copy = ()=>copyText(window.location.href);
  return <>
    <PageIntro eyebrow="PUBLIC ACCOUNT PROFILE / PASSPORT" title="Evidence passport" description="A shareable read-only account profile. This account-level view does not prove which key belongs to an AI agent." action={<button className="button button-outline" onClick={copy}><Copy size={14}/> Copy link</button>}/>
    {loading && <div className="page-loader inline-loader"><span className="loader-orbit"/>Inspecting {decoded}</div>}
    {error && <div className="inline-alert error-alert"><ShieldAlert size={16}/>{error}</div>}
    {data && <>
      <div className="passport-hero"><div className="passport-mark"><Fingerprint size={34}/></div><div><div className="eyebrow">NEAR ACCOUNT / {data.network?.toUpperCase()}</div><h2>{data.accountId}</h2><p>Snapshot at block {data.blockHeight?.toLocaleString() || 'unknown'} · {new Date(data.inspectedAt).toLocaleString()}</p></div><StateTag state={data.keyAssessment?.exposure || 'UNKNOWN'}/></div>
      <div className="metric-grid result-metrics"><div className="metric-card"><div className="metric-top"><span>KEYS</span><Fingerprint size={15}/></div><strong>{data.keys?.length || 0}</strong><small>Publicly registered keys</small></div><div className="metric-card"><div className="metric-top"><span>FULL ACCESS</span><ShieldAlert size={15}/></div><strong>{data.keyAssessment?.fullAccessCount ?? 0}</strong><small>Account-level count</small></div><div className="metric-card"><div className="metric-top"><span>FUNCTION CALL</span><ShieldCheck size={15}/></div><strong>{data.keyAssessment?.functionCallCount ?? 0}</strong><small>Account-level count</small></div><div className="metric-card metric-card-dark"><div className="metric-top"><span>CODE HASH</span><Fingerprint size={15}/></div><strong>{data.hasContract?'Contract':'No contract'}</strong><small>{shorten(data.codeHash,9,7)}</small></div></div>
      <Panel title="Registered access keys" subtitle="Public permissions; key-holder identity is not inferred."><div className="key-list">{data.keys?.map((key:any,index:number)=><div className="key-card" key={key.publicKey}><div className="key-card-top"><div><span className="key-index">KEY {index+1}</span><strong>{key.kind}</strong></div><StateTag state={key.kind==='FullAccess'?'Critical authority':key.unrestrictedMethods?'Unrestricted methods':'Scoped methods'}/></div><div className="key-public"><code>{key.publicKey}</code><button className="icon-button" onClick={()=>copyText(key.publicKey)} aria-label="Copy public key"><Copy size={14}/></button></div>{key.kind==='FunctionCall'&&<div className="key-properties"><div><span>RECEIVER</span><strong>{key.receiverId||'Unknown'}</strong></div><div><span>METHODS</span><strong>{key.methodNames?.length?key.methodNames.join(', '):'All methods'}</strong></div><div><span>GAS ALLOWANCE</span><strong>{key.allowanceNear?`${key.allowanceNear} NEAR`:'Not set'}</strong></div></div>}</div>)}</div></Panel>
      <Panel title="Interpretation" subtitle="This is a public account snapshot, not a wallet audit."><ul className="limitation-list">{data.limitations?.map((l:string,i:number)=><li key={i}>{l}</li>)}</ul><Link to="/inspect" className="button button-lime">Run an agent-specific inspection <ArrowUpRight size={14}/></Link></Panel>
    </>}
  </>;
}
