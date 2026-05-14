import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const isAdmin = user?.role === 'admin';
  const isBranchManager = user?.role === 'branch_manager';
  const isClusterManager = user?.role === 'cluster_manager';
  const isZonalManager = user?.role === 'zonal_manager';

  return { user, loading, isAdmin, isBranchManager, isClusterManager, isZonalManager };
}