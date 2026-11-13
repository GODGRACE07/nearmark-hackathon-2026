export type NearmarkDecision = {
  decision: 'ALLOW' | 'WARN' | 'BLOCK';
  receiver: string;
  amount: string;
  reasons: string[];
  evidence: Array<{ type: string; detail: string }>;
  confidence: 'low' | 'moderate' | 'high';
  disclaimer: string;
};

export type NearmarkGateStatus = {
  agent_id: string;
  agent_public_key: string;
  allowed_receivers: string[];
  max_payment_yocto: string;
  daily_limit_yocto: string;
  spent_today_yocto: string;
  next_nonce: string;
  paused: boolean;
};

export type NearmarkGatePaymentArgs = {
  receiver_id: string;
  amount_yocto: string;
  nonce: string;
  expires_at_ns: string;
  memo: string;
};

export type NearmarkGateAdapter<TResult = unknown> = {
  accountId: string;
  getStatus: () => Promise<NearmarkGateStatus>;
  executePayment: (args: NearmarkGatePaymentArgs) => Promise<TResult>;
};

export type NearApiJsGateAdapterOptions = {
  account: {
    accountId: string;
    callFunction: (input: {
      contractId: string;
      methodName: 'execute_payment';
      args: NearmarkGatePaymentArgs;
      gas: bigint;
      deposit: 0n;
    }) => Promise<unknown>;
  };
  provider: {
    callFunction: (input: { contractId: string; method: 'get_status'; args: Record<string, never> }) => Promise<NearmarkGateStatus>;
  };
  agentAccountId: string;
  gateAccountId: string;
  gas?: string | bigint;
};

export function createNearApiJsGateAdapter(options: NearApiJsGateAdapterOptions): NearmarkGateAdapter;

export type NearmarkCounterpartyInput = {
  agentAccount: string;
  agentPublicKey?: string;
  receiver: string;
  amount: string;
  method?: string;
  allowedRecipients?: string[];
  strictRecipients?: boolean;
  maxAmount?: string | number;
  allowedMethods?: string[];
  [key: string]: unknown;
};

export class NearmarkClient {
  constructor(options?: { baseUrl?: string; fetchImpl?: typeof fetch });
  inspect(accountId: string, agentPublicKey?: string): Promise<any>;
  checkCounterparty(input: Record<string, unknown>): Promise<NearmarkDecision>;
  runBenchmark(profile?: 'nearmark-guard' | 'function-call-baseline' | 'full-access-baseline'): Promise<any>;
  getBenchmarkRuns(): Promise<{ runs: any[] }>;
  getReports(): Promise<{ reports: any[] }>;
  enforceDecision(
    input: NearmarkCounterpartyInput,
    options?: { onWarn?: (decision: NearmarkDecision) => boolean | Promise<boolean> }
  ): Promise<NearmarkDecision>;
  executeThroughGate<TResult = unknown>(
    input: NearmarkCounterpartyInput & { agentPublicKey: string },
    options?: {
      gate: NearmarkGateAdapter<TResult>;
      gateAccountId: string;
      onWarn?: (decision: NearmarkDecision) => boolean | Promise<boolean>;
      memo?: string;
      expiresInMs?: number;
      nowNs?: () => bigint | string;
    }
  ): Promise<{
    decision: NearmarkDecision;
    gateAccountId: string;
    args: NearmarkGatePaymentArgs;
    execution: TResult;
  }>;
}

export interface AuthorityShadowResult { standard: string; agentAccount: string; status?: string; downstreamAuthority: Array<Record<string, unknown>>; summary: string; disclaimer: string; }

export interface AuthorityShadowResult { standard: string; agentAccount: string; status?: string; downstreamAuthority: Array<Record<string, unknown>>; summary: string; disclaimer: string; }
