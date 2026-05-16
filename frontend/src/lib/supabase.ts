import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const authEnabledEnv = import.meta.env.VITE_AUTH_ENABLED;
export const authEnabled =
  authEnabledEnv !== undefined
    ? authEnabledEnv === 'true'
    : Boolean(supabaseUrl && supabaseAnonKey);

const missingConfig: string[] = [];
if (!supabaseUrl) missingConfig.push('VITE_SUPABASE_URL');
if (!supabaseAnonKey) missingConfig.push('VITE_SUPABASE_ANON_KEY');
if (authEnabledEnv !== undefined && authEnabledEnv !== 'true') {
  missingConfig.push('VITE_AUTH_ENABLED (must be "true")');
}

function createNoopSupabaseClient() {
  const errMsg =
    missingConfig.length > 0
      ? `Authentication is not configured. Missing environment variables: ${missingConfig.join(', ')}`
      : 'Authentication is not configured for this environment.';

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: new Error(errMsg) }),
      signInWithPassword: async () => ({ data: null, error: new Error(errMsg) }),
      signUp: async () => ({ data: null, error: new Error(errMsg) }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ error: new Error(errMsg) }),
      updateUser: async () => ({ error: new Error(errMsg) }),
    },
  };
}

export const supabase =
  authEnabled && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : createNoopSupabaseClient();

/**
 * Get the current session's access token for API calls.
 * Returns null if no session exists.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!authEnabled || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
