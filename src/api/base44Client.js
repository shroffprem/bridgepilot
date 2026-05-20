import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TABLE_MAP = {
  Loan:               'loans',
  Borrower:           'borrowers',
  CapitalEntry:       'capital_entries',
  Collection:         'collections',
  CollectionActivity: 'collection_activities',
  Company:            'companies',
  Disbursal:          'disbursals',
  Repayment:          'repayments',
  TeamMember:         'team_members',
  Territory:          'territories',
  User:               'profiles',
};

function makeEntity(tableName) {
  return {
    async list() {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw new Error(error.message);
      return data;
    },
    async filter(conditions = {}) {
      let query = supabase.from(tableName).select('*');
      for (const [key, value] of Object.entries(conditions)) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
    async create(payload) {
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    async update(id, payload) {
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}

const auth = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    return {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name ?? user.user_metadata?.full_name ?? '',
      role: profile?.role ?? 'sales_officer',
      cluster: profile?.cluster ?? null,
      branch: profile?.branch ?? null,
      ...profile,
    };
  },
  async loginViaEmailPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },
  async register({ email, password }) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
  },
  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'signup',
    });
    if (error) throw new Error(error.message);
    return { access_token: data?.session?.access_token };
  },
  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw new Error(error.message);
  },
  setToken(_token) {},
  async resetPasswordRequest(email) {
    const redirectTo = window.location.origin + '/reset-password?token=reset';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(error.message);
  },
  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },
  loginWithProvider(provider, redirectPath = '/') {
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + redirectPath },
    });
  },
  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (redirectUrl) window.location.href = redirectUrl;
  },
  redirectToLogin(_returnUrl) {
    window.location.href = '/login';
  },
};

const entities = Object.fromEntries(
  Object.entries(TABLE_MAP).map(([entityName, tableName]) => [
    entityName,
    makeEntity(tableName),
  ])
);

export const base44 = { entities, auth };
