import { createClient } from '@supabase/supabase-js';

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw Object.assign(new Error('Supabase Auth is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.'), { status: 503, code: 'SUPABASE_NOT_CONFIGURED' });
  return { url: url.replace(/\/$/, ''), key };
}

export function bearerToken(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] || null;
}

export async function authenticateSupabaseRequest(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const { url, key } = config();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return { user: data.user, accessToken: token };
}

export function createSupabaseUserClient(auth) {
  if (!auth?.accessToken) throw Object.assign(new Error('Authenticated Supabase user is required.'), { status: 401 });
  const { url, key } = config();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${auth.accessToken}` } },
  });
}

export function createSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Object.assign(new Error('Webhook persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.'), { status: 503, code: 'SUPABASE_ADMIN_NOT_CONFIGURED' });
  return createClient(url.replace(/\/$/, ''), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
