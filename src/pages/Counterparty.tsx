import { useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, ClipboardCheck, FilePlus2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { post } from '../lib/api';
import { PageIntro, Panel, StateTag } from '../components/Chrome';

export default function Counterparty() {
  const [agent, setAgent] = useState('agent.near');
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('1');
  const [method, setMethod] = useState('transfer');
  const [allowed, setAllowed] = useState('');
  const [max, setMax] = useState('10');
  const [strict, setStrict] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState({ category:'suspicious-activity', evidenceRef:'', description:'', reporter:'' });
  const [reportResult, setReportResult] = useState('');
  const check = async (e:FormEvent) => {
    e.preventDefault(); setLoading(true); setError(''); setResult(null);
    try {
      const response = await post<any>('/api/counterparty/check', {
        agentAccount: agent, receiver: receiver.trim().toLowerCase(), amount, method,
        allowedRecipients: allowed.split(/[\s,]+/).map(x=>x.trim().toLowerCase()).filter(Boolean),
        maxAmount: max, strictRecipients: strict, allowedMethods: ['transfer','function_call'],
      });
      setResult(response);
    } catch (err:any) { setError(err.message || 'Counterparty check failed.'); }
    finally { setLoading(false); }
  };
  const submitReport = async (e:FormEvent) => {
    e.preventDefault(); setReportResult('');
    try { const r = await post<any>('/api/reports', { receiver: receiver.trim().toLowerCase(), ...report }); setReportResult(`Report ${r.report.id} submitted as PENDING. It will not automatically block the account.`); setShowReport(false); }
    catch (err:any) { setReportResult(err.message || 'Report could not be submitted.'); }
  };
  return <>
    <PageIntro eyebrow="TRANSACTION INTELLIGENCE / 02" title="Counterparty check" description="Check the receiving NEAR account against a live finalized RPC read and an owner-defined payment mandate. Unknown evidence stays visible as unknown." action={<a href="https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/06-security.md" target="_blank" rel="noreferrer" className="button button-outline">Track 06 spec <ArrowUpRight size={14}/></a>}/>
    <div className="two-column-layout">
      <Panel title="Proposed transaction" subtitle="No transaction is signed or broadcast by this checker.">
        <form className="stack-form" onSubmit={check}>
          <label className="field"><span>AGENT ACCOUNT</span><input value={agent} onChange={e=>setAgent(e.target.value)} placeholder="agent.near"/></label>
          <label className="field"><span>RECIPIENT NEAR ACCOUNT</span><input value={receiver} onChange={e=>setReceiver(e.target.value)} placeholder="vendor.near" required/></label>
          <div className="field-row"><label className="field"><span>AMOUNT</span><input type="number" min="0.000001" step="any" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label className="field"><span>ASSET</span><select value="NEAR" disabled><option>NEAR</option></select></label></div>
          <label className="field"><span>PROPOSED ACTION</span><select value={method} onChange={e=>setMethod(e.target.value)}><option value="transfer">Native NEAR transfer</option><option value="function_call">Contract interaction</option></select></label>
          <div className="subform-divider"/>
          <div className="mandate-header"><div><strong>Owner payment mandate</strong><small>These rules are supplied for this check. A production owner-signed mandate is not deployed in this prototype.</small></div><ClipboardCheck size={18}/></div>
          <label className="field"><span>APPROVED RECIPIENTS</span><textarea value={allowed} onChange={e=>setAllowed(e.target.value)} rows={2} placeholder="vendor.near, payroll.near"/><small>Separate accounts with commas or spaces.</small></label>
          <div className="field-row"><label className="field"><span>MAX AMOUNT (NEAR)</span><input type="number" min="0.000001" step="any" value={max} onChange={e=>setMax(e.target.value)}/></label><label className="toggle-field"><span>Strict recipient list</span><input type="checkbox" checked={strict} onChange={e=>setStrict(e.target.checked)}/><small>Unlisted recipients are blocked.</small></label></div>
          <button className="button button-lime button-full" type="submit" disabled={loading || !receiver.trim()}>{loading?<><span className="button-spinner"/>Checking live account…</>:<>Run counterparty check <ArrowUpRight size={15}/></>}</button>
        </form>
        {error && <div className="inline-alert error-alert"><ShieldAlert size={16}/>{error}</div>}
      </Panel>
      <div className="result-column">
        <Panel title="Decision" subtitle="Decision combines live receiver state with the mandate entered on this page." className="decision-panel">
          <AnimatePresence mode="wait">{result ? <motion.div key={result.checkedAt} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
            <div className={`decision-display decision-${result.decision.toLowerCase()}`}><div className="decision-icon">{result.decision==='ALLOW'?<CheckCircle2 size={25}/>:result.decision==='BLOCK'?<ShieldAlert size={25}/>:<AlertTriangle size={25}/>}</div><div><span>NEARMARK DECISION</span><strong>{result.decision}</strong></div></div>
            <div className="decision-reasons"><h4>Reasons</h4>{result.reasons?.map((reason:string)=><div className="reason-row" key={reason}><i className={result.decision==='BLOCK'?'reason-danger':'reason-neutral'}/><code>{reason}</code></div>)}</div>
            <div className="decision-reasons"><h4>Live evidence</h4>{result.evidence?.length ? result.evidence.map((item:any,i:number)=><div className="evidence-row" key={i}><span>{item.type}</span><p>{item.detail}</p></div>) : <p className="muted-small">No positive evidence returned. A decision is not proof of safety.</p>}{result.receiverEvidence?.error && <div className="inline-alert warn-alert"><AlertTriangle size={14}/>{result.receiverEvidence.error}</div>}</div>
            <div className="decision-meta"><span>Checked {new Date(result.checkedAt).toLocaleTimeString()}</span><span>Confidence: {result.confidence}</span></div>
            <p className="helper-note">{result.disclaimer}</p>
          </motion.div> : <div className="decision-empty"><div className="empty-radar"><span/><span/><span/><ShieldCheck size={25}/></div><strong>Waiting for a transaction</strong><p>Enter a recipient and run the live check. Nearmark will query the public NEAR state and apply your payment mandate.</p></div>}</AnimatePresence>
        </Panel>
        <Panel title="Evidence reporting" subtitle="Report suspicious addresses with evidence. Reports are pending until independently reviewed.">
          <button className="button button-outline button-full" onClick={()=>setShowReport(v=>!v)} disabled={!receiver.trim()}><FilePlus2 size={15}/> Submit evidence report</button>
          {showReport && <form className="stack-form report-form" onSubmit={submitReport}><label className="field"><span>CATEGORY</span><select value={report.category} onChange={e=>setReport({...report,category:e.target.value})}><option value="suspicious-activity">Suspicious activity</option><option value="recipient-substitution">Recipient substitution</option><option value="malicious-contract">Malicious contract</option><option value="phishing">Phishing / impersonation</option></select></label><label className="field"><span>EVIDENCE REFERENCE</span><input value={report.evidenceRef} onChange={e=>setReport({...report,evidenceRef:e.target.value})} placeholder="Transaction hash or code hash" required/></label><label className="field"><span>DESCRIPTION</span><textarea value={report.description} onChange={e=>setReport({...report,description:e.target.value})} rows={3}/></label><button className="button button-lime" type="submit">Submit pending report <ArrowUpRight size={14}/></button></form>}
          {reportResult && <div className="inline-alert warn-alert"><AlertTriangle size={14}/>{reportResult}</div>}
        </Panel>
      </div>
    </div>
  </>;
}
