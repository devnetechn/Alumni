import { createContext, useContext, useState, useEffect } from 'react';
import { api, setTrialExpiredHandler, setRegistrationExpiredHandler } from './api';
import { connectSocket, disconnectSocket } from './socket';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState(null);
  const [trialExpired, setTrialExpired] = useState(null);
  const [registrationExpired, setRegistrationExpired] = useState(null);
  const [membership, setMembership] = useState(null);
  const [managedBatches, setManagedBatches] = useState([]);
  const [unread, setUnread] = useState(0);
  const [meReady, setMeReady] = useState(false);

  // Enrich token user with alumni profile fields (is_batch_leader etc.)
  const refresh = async () => {
    try {
      const { data } = await api.get('/me');
      setMembership(data.membership);
      setManagedBatches(data.managedBatches || []);
      api.get('/notifications').then((r) => setUnread(r.data.unread)).catch(() => {});
      setUser((prev) => {
        const next = { ...(prev || {}), is_batch_leader: !!data.me?.is_batch_leader, full_name: data.me?.full_name, profile_pic: data.me?.profile_pic, batch_year: data.me?.batch_year };
        localStorage.setItem('user', JSON.stringify(next));
        return next;
      });
    } catch {}
    setMeReady(true);
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (stored) {
      setUser(JSON.parse(stored));
      refresh();
    } else {
      setMeReady(true);
    }
    if (token) connectSocket(token);
    setLoading(false);
  }, []);

  useEffect(() => {
    setTrialExpiredHandler((data) => setTrialExpired(data));
    setRegistrationExpiredHandler((data) => setRegistrationExpired(data));
    api.get('/school').then((r) => setSchool(r.data)).catch(() => {});
  }, []);

  const refreshSchool = () => api.get('/school').then((r) => setSchool(r.data)).catch(() => {});

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
    setMembership(null);
    setManagedBatches([]);
    setUnread(0);
  };

  return (
    <AuthCtx.Provider value={{ user, meReady, membership, managedBatches, unread, setUnread, login, register, logout, loading, refresh, refreshSchool, school, trialExpired, registrationExpired, setSession }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
