import { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
    if (stored) {
      setUser(JSON.parse(stored));
      refresh();
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    await refresh();
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    await refresh();
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, login, register, logout, loading, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
