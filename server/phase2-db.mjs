import { createSupabaseUserClient } from './phase2-auth.mjs';

export async function insertUserRow(auth, table, row) {
  const client = createSupabaseUserClient(auth);
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw Object.assign(new Error(`Persistent ${table} insert failed: ${error.message}`), { status: 503, code: 'PERSISTENCE_WRITE_FAILED' });
  return data;
}

export async function listUserRows(auth, table, select = '*', limit = 100) {
  const client = createSupabaseUserClient(auth);
  const { data, error } = await client.from(table).select(select).order('created_at', { ascending: false }).limit(limit);
  if (error) throw Object.assign(new Error(`Persistent ${table} read failed: ${error.message}`), { status: 503, code: 'PERSISTENCE_READ_FAILED' });
  return data || [];
}

export async function adminUpsert(table, row, onConflict) {
  const { createSupabaseAdminClient } = await import('./phase2-auth.mjs');
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from(table).upsert(row, { onConflict }).select('*');
  if (error) throw Object.assign(new Error(`Admin ${table} upsert failed: ${error.message}`), { status: 503, code: 'PERSISTENCE_ADMIN_FAILED' });
  return data || [];
}

export async function adminInsertIgnoreDuplicate(table, row) {
  const { createSupabaseAdminClient } = await import('./phase2-auth.mjs');
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from(table).insert(row).select('*');
  if (error && !/duplicate key|23505/i.test(error.message || '')) {
    throw Object.assign(new Error(`Admin ${table} insert failed: ${error.message}`), { status: 503, code: 'PERSISTENCE_ADMIN_FAILED' });
  }
  return data || [];
}
