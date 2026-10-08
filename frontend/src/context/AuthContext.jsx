import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, post, refreshSession, setAccessToken, setSessionLostHandler } from '../lib/api.js';
import { connectSocket, disconnectSocket, reconnectSocket } from '../lib/socket.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    qc.clear();
    disconnectSocket();
    connectSocket(); // keep anonymous public rooms working
  }, [qc]);

  // Restore the session from the httpOnly refresh cookie on first load
  useEffect(() => {
    let alive = true;
    setSessionLostHandler(() => { if (alive) clear(); });
    refreshSession()
      .then((d) => { if (alive) { setUser(d.user); reconnectSocket(); } })
      .catch(() => { if (alive) connectSocket(); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [clear]);

  const start = useCallback((data) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
    reconnectSocket();
    return data.user;
  }, []);

  const login = useCallback(async (credentials) => start((await post('/auth/login', credentials)).data), [start]);
  const register = useCallback(async (payload) => start((await post('/auth/register', payload)).data), [start]);
  const logout = useCallback(async () => {
    try { await post('/auth/logout'); } catch { /* cookie is cleared server-side when reachable */ }
    clear();
  }, [clear]);
  const updateUser = useCallback((u) => setUser((prev) => ({ ...prev, ...u })), []);
  const reloadUser = useCallback(async () => { const r = await api.get('/auth/me'); setUser(r.data.data.user); }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, updateUser, reloadUser, setSession: start }), [user, loading, login, register, logout, updateUser, reloadUser, start]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
