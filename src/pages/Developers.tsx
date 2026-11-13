import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, ExternalLink, KeyRound, Package, Terminal, Wallet, Zap, RefreshCw } from 'lucide-react';
import { PageIntro, Panel, StateTag } from '../components/Chrome';
import { api, copyText } from '../lib/api';

export default function Developers() {
  const [integrations,setIntegrations] = useState<any>(null);
  const [copied,setCopied] = useState('');
  const [outlayerData,setOutlayerData] = useState<any>(null);
  const [outlayerLoading,setOutlayerLoading] = useState(false);
  const [outlayerError,setOutlayerError] = useState('');
  const [models,setModels] = useState<any[]>([]);
  const [modelsMessage,setModelsMessage] = useState('');
  const [modelsLoading,setModelsLoading] = useState(false);
  useEffect(()=>{api('/api/integrations').then(setIntegrations).catch(()=>setIntegrations(null));},[]);
  const copy = async (key:string, value:string) => {await copyText(value);setCopied(key);setTimeout(()=>setCopied(''),1500);};
  const inspectOutlayer = async () => {setOutlayerLoading(true);setOutlayerError('');try{setOutlayerData(await api('/api/outlayer/inspect'));}catch(e:any){setOutlayerError(e.message||'OutLayer inspection failed.');}finally{setOutlayerLoading(false);}};
  const loadModels = async () => {setModelsLoading(true);setModelsMessage('');try{const r:any=await api('/api/near-ai/models');setModels(r.models||[]);setModelsMessage(r.configured?`${(r.models||[]).length} model entries returned from NEAR AI Cloud.`:r.message);}catch(e:any){setModelsMessage(e.message||'Model discovery failed.');}finally{setModelsLoading(false);}};
  const snippet = `import { NearmarkClient } from "@nearmark/sdk";\n\nconst nm = new NearmarkClient({ baseUrl: "http://localhost:8787" });\nconst wallet = await nm.inspect("agent.near");\nconst decision = await nm.checkCounterparty({\n  agentAccount: "agent.near",\n  receiver: "vendor.near",\n  amount: "5",\n  allowedRecipients: ["vendor.near"],\n  maxAmount: "10",\n  strictRecipients: true\n});\n\nif (decision.decision === "BLOCK") throw new Error("Payment blocked");\nif (decision.decision === "WARN") await requireHumanApproval(decision);`;
  return <>
    <PageIntro eyebrow="DEVELOPER PLATFORM / 05" title="Build with Nearmark" description="Integrate wallet inspection and recipient-risk decisions into your own NEAR agents. The browser app is only one interface to the security engine." action={<a href="https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/06-security.md" target="_blank" rel="noreferrer" className="button button-outline">Track requirements <ExternalLink size={14}/></a>}/>
    <div className="developer-hero"><div><div className="eyebrow"><span className="pulse-pin"/> OPEN DEVELOPER INTERFACE</div><h2>Security checks<br/>where your agent <em>works.</em></h2><p>Start with the REST API, install the TypeScript SDK, or automate checks from your CI pipeline. No wallet connection is needed for read-only inspection.</p></div><div className="install-card"><div className="install-head"><Package size={16}/> INSTALL / SDK</div><code>npm install ./packages/sdk</code><button className="icon-button" onClick={()=>copy('install','npm install ./packages/sdk')} aria-label="Copy install command">{copied==='install'?<Check size={15}/>:<Copy size={15}/>}</button><small>Local workspace SDK source is in <code>packages/sdk</code>. Publish to npm only after package review.</small></div></div>
    <div className="developer-grid">
      <Panel title="TypeScript SDK" subtitle="Thin typed client over the Nearmark API" action={<StateTag state="Source included"/>}>
        <div className="code-toolbar"><span>EXAMPLE.TS</span><button onClick={()=>copy('sdk',snippet)}>{copied==='sdk'?<Check size={14}/>:<Copy size={14}/>} {copied==='sdk'?'Copied':'Copy'}</button></div><pre className="code-block"><code>{snippet}</code></pre><p className="helper-note">The API decision is advisory unless your agent's signing/execution path enforces it. Never pass private keys to the SDK.</p>
      </Panel>
      <Panel title="REST API" subtitle="Available from the local API server" action={<a className="panel-link" href="/api/docs/openapi.json" target="_blank">Open schema <ArrowUpRight size={13}/></a>}>
        <div className="endpoint-list">{[['POST','/api/inspect','Public account and access-key inspection'],['POST','/api/counterparty/check','Mandate-aware receiver assessment'],['POST','/api/benchmark/run','Run deterministic core suite'],['POST','/api/benchmark/compare','Compare built-in reference profiles'],['GET','/api/benchmark/runs','Saved benchmark reports'],['POST','/api/reports','Submit evidence report (pending)']].map(([method,path,desc])=><div className="endpoint-row" key={path}><span className={`method-chip ${method.toLowerCase()}`}>{method}</span><code>{path}</code><small>{desc}</small></div>)}</div>
      </Panel>
    </div>
    <Panel title="Integration status" subtitle="Actual server-side environment configuration. Secrets are never exposed to this page.">
      <div className="integration-status-grid">{[
        ['NEAR RPC',integrations?.near?.status||'checking','Read-only account state', 'https://docs.near.org/api/rpc/introduction'],
        ['FastNear',integrations?.fastnear?.status||'checking','Indexed account history','https://tx.main.fastnear.com/'],
        ['NEAR AI Cloud',integrations?.nearAi?.status||'checking','Requires server-side NEAR_AI_API_KEY','https://docs.near.ai/'],
        ['OutLayer',integrations?.outlayer?.status||'checking','Requires API key and configured wallet/worker','https://app.outlayer.ai/docs/agent-custody'],
      ].map(([name,status,desc,url])=><div className="integration-status" key={name}><div><strong>{name}</strong><StateTag state={String(status)}/></div><p>{desc}</p><a href={String(url)} target="_blank" rel="noreferrer">Documentation <ArrowUpRight size={12}/></a></div>)}</div>
      <p className="helper-note">{integrations?.safety || 'Integration status is based on local server configuration.'}</p>
    </Panel>
    <div className="developer-grid">
      <Panel title="OutLayer custody inspection" subtitle="Read-only: address, NEAR balance and current wallet policy. No signing or transfer endpoint is called." action={<StateTag state={integrations?.outlayer?.status||'checking'}/>}>
        <button className="button button-outline button-small" onClick={inspectOutlayer} disabled={outlayerLoading}>{outlayerLoading?<><span className="button-spinner"/>Reading OutLayer</>:<><RefreshCw size={13}/> Inspect configured wallet</>}</button>
        {outlayerError&&<div className="inline-alert warn-alert">{outlayerError}</div>}
        {outlayerData&&<div className="outlayer-data"><div><span>ADDRESS</span><code>{JSON.stringify(outlayerData.address)}</code></div><div><span>BALANCE</span><code>{JSON.stringify(outlayerData.balance)}</code></div><div><span>POLICY</span><code>{JSON.stringify(outlayerData.policy,null,2)}</code></div><p>{outlayerData.notice}</p></div>}
        <p className="helper-note">Configure OUTLAYER_API_KEY on the server. Use a dedicated, minimum-privilege assessment wallet. Keep the key out of browser code and repositories.</p>
      </Panel>
      <Panel title="NEAR AI Cloud model discovery" subtitle="Query the live models endpoint when NEAR_AI_API_KEY is configured on the server.">
        <button className="button button-outline button-small" onClick={loadModels} disabled={modelsLoading}>{modelsLoading?<><span className="button-spinner"/>Loading models</>:<><RefreshCw size={13}/> Discover models</>}</button>
        {modelsMessage&&<p className="helper-note">{modelsMessage}</p>}
        {models.length>0&&<div className="model-list">{models.slice(0,12).map((m:any,i:number)=><div key={m.id||m.name||i}><code>{m.id||m.name||JSON.stringify(m)}</code><StateTag state="Discovered"/></div>)}</div>}
        <p className="helper-note">Model discovery and inference are real when credentials are configured. This app does not display TEE Verified unless a separate official attestation-verification step succeeds.</p>
      </Panel>
    </div>
    <div className="resource-grid">
      <a className="resource-card" href="https://docs.near.org" target="_blank" rel="noreferrer"><Wallet size={19}/><div><strong>NEAR Protocol docs</strong><small>Accounts, RPC, access keys and contracts</small></div><ArrowUpRight size={15}/></a>
      <a className="resource-card" href="https://docs.near.ai" target="_blank" rel="noreferrer"><Zap size={19}/><div><strong>NEAR AI Cloud</strong><small>Models and confidential verification</small></div><ArrowUpRight size={15}/></a>
      <a className="resource-card" href="https://app.outlayer.ai/docs" target="_blank" rel="noreferrer"><KeyRound size={19}/><div><strong>OutLayer docs</strong><small>Agent Custody, WASI and TEE attestations</small></div><ArrowUpRight size={15}/></a>
      <a className="resource-card" href="https://docs.fastnear.com/tx" target="_blank" rel="noreferrer"><Terminal size={19}/><div><strong>FastNear transactions</strong><small>Indexed account history and transaction records</small></div><ArrowUpRight size={15}/></a>
    </div>
  </>;
}
