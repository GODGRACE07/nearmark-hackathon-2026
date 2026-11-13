import { readFile, writeFile, chmod } from 'node:fs/promises';

const ENV_FILE = '.env';
const LEGACY_FILES = ['.env.local'];
const DEFAULTS = {
  NEAR_NETWORK: 'testnet',
  NEAR_RPC_URL: 'https://rpc.testnet.near.org',
  FASTNEAR_TX_API: 'https://tx.test.fastnear.com/v0/account',
  NEAR_AI_BASE_URL: 'https://cloud-api.near.ai/v1',
  NEAR_AI_MODEL: 'deepseek-ai/DeepSeek-V4.1-Flash-1017-abliterated',
  OUTLAYER_API_URL: 'https://testnet-api.outlayer.ai',
  PORT: '8787',
  ALLOWED_ORIGIN: 'http://localhost:5173',
};

async function readOptional(path) {
  try { return await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}
function parseEnv(source) {
  const values = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values.set(match[1], value);
  }
  return values;
}
function setEnvValue(source, name, value) {
  const lines = source.split(/\r?\n/);
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`);
  let replaced = false;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (pattern.test(lines[index])) {
      lines[index] = `${name}=${value}`;
      replaced = true;
      break;
    }
  }
  if (!replaced) lines.push(`${name}=${value}`);
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

let current = await readOptional(ENV_FILE);
const values = parseEnv(current);
const legacy = new Map();
for (const file of LEGACY_FILES) {
  const parsed = parseEnv(await readOptional(file));
  for (const [key, value] of parsed) if (!legacy.has(key)) legacy.set(key, value);
}

let changed = false;
if (!values.get('NEAR_AI_API_KEY')) {
  const migrated = legacy.get('NEAR_AI_API_KEY') || legacy.get('NEARAI_API_KEY');
  if (migrated) {
    current = setEnvValue(current, 'NEAR_AI_API_KEY', migrated);
    values.set('NEAR_AI_API_KEY', migrated);
    changed = true;
    console.log('Migrated the existing NEAR AI key from .env.local to .env without displaying it.');
  }
}
for (const [key, value] of Object.entries(DEFAULTS)) {
  if (!values.get(key)) {
    current = setEnvValue(current, key, value);
    values.set(key, value);
    changed = true;
  }
}
if (changed) {
  await writeFile(ENV_FILE, current, { mode: 0o600 });
  await chmod(ENV_FILE, 0o600);
  console.log('Filled missing safe defaults in .env; existing non-empty settings were preserved.');
} else {
  await chmod(ENV_FILE, 0o600);
  console.log('Environment already contains the required defaults.');
}
console.log(values.get('NEAR_AI_API_KEY') ? 'NEAR AI credentials: present (live verified inference still requires an authenticated app user).' : 'NEAR AI credentials: not configured (AI provider check will be skipped).');
console.log(values.get('OUTLAYER_API_KEY') ? 'OutLayer credentials: present (live verified inference still requires an authenticated app user).' : 'OutLayer credentials: not configured (remote custody/TEE checks will be skipped).');
