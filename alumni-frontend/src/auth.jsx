import { createContext, useContext, useState, useEffect } from 'react';
import { api, setTrialExpiredHandler } from './api';
import { connectSocket, disconnectSocket } from './socket';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState(null);
  const [trialExpired, setTrialExpired] = useState(null);

  // Enrich token user with alumni profile fields (is_batch_leader etc.)
  const refresh = async () => {
    try {
      const { data } = await api.get('/me');
      setUser((prev) => {
        const next = { ...(prev || {}), is_batch_leader: !!data.me?.is_batch_leader };
        localStorage.setItem('user', JSON.stringify(next));
        return next;
      });
    } catch {}
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (stored) {
      setUser(JSON.parse(stored));
      refresh();
    }
    if (token) connectSocket(token);
    setLoading(false);
  }, []);

  useEffect(() => {
    setTrialExpiredHandler((data) => setTrialExpired(data));
    api.get('/school').then((r) => setSchool(r.data)).catch(() => {});
  }, []);

  const setSession = (token, user) => {
    localStorage.setItem('token', token);
    connectSocket(token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setSession(data.token, data.user);
    await refresh();
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setSession(data.token, data.user);
    await refresh();
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, login, register, logout, loading, refresh, school, trialExpired, setSession }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
