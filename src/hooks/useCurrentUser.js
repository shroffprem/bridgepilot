import { useState, useEffect } from 'react';
import { supabase } from '@/api/base44Client';

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setLoading(false); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setUser({
        id: session.user.id,
        email: session.user.email,
        full_name: profile?.full_name ?? '',
        role: profile?.role ?? 'sales_officer',
        cluster: profile?.cluster ?? null,
        branch: profile?.branch ?? null,
        ...profile,
      });
      setLoading(false);
    });
  }, []);

  return {
    user,
    loading,
    isAdmin: user?.role === 'admin',
    isManagingPartner: user?.role === 'managing_partner',
    isSalesOfficer: user?.role === 'sales_officer',
    isBranchManager: user?.role === 'branch_manager',
    isClusterManager: user?.role === 'cluster_manager',
    isZonalManager: user?.role === 'zonal_manager',
  };
}
