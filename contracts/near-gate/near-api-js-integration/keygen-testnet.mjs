import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { KeyPair } from 'near-api-js';

const [action, filePath] = process.argv.slice(2);
if (!action || !filePath) {
  console.error('Usage: node keygen-testnet.mjs create|show <key-file>');
  process.exit(2);
}

const absolutePath = path.resolve(filePath);

if (action === 'create') {
  try {
    await readFile(absolutePath, 'utf8');
    console.error(`Refusing to overwrite an existing key file: ${absolutePath}`);
    process.exit(3);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const pair = KeyPair.fromRandom('ed25519');
  const record = {
    network: 'testnet',
    publicKey: pair.getPublicKey().toString(),
    secretKey: pair.toString(),
    createdAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  await writeFile(absolutePath, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await chmod(absolutePath, 0o600);
  console.log(record.publicKey);
  process.exit(0);
}

if (action === 'show') {
  const record = JSON.parse(await readFile(absolutePath, 'utf8'));
  const pair = KeyPair.fromString(record.secretKey);
  const actual = pair.getPublicKey().toString();
  if (actual !== record.publicKey) throw new Error('Key file public/private key mismatch.');
  if (record.network !== 'testnet') throw new Error('Refusing to use a non-Testnet key file.');
  console.log(actual);
  process.exit(0);
}

throw new Error(`Unknown action: ${action}`);
