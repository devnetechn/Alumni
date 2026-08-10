import axios from 'axios';

// In local dev, Vite proxies /api to the backend (see vite.config.js) so this
// stays relative. In production, VITE_API_BASE_URL points at the deployed
// backend origin (e.g. https://alumni-backend.onrender.com) — same pattern
// as VITE_SOCKET_URL in socket.js.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let trialExpiredHandler = null;
export function setTrialExpiredHandler(fn) {
  trialExpiredHandler = fn;
}

let registrationExpiredHandler = null;
export function setRegistrationExpiredHandler(fn) {
  registrationExpiredHandler = fn;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    if (error.response && error.response.status === 402) {
      if (error.response.data.error === 'Registration expired' && registrationExpiredHandler) {
        registrationExpiredHandler(error.response.data);
      } else if (trialExpiredHandler) {
        trialExpiredHandler(error.response.data);
      }
    }
    return Promise.reject(error);
  }
);

export const platformApi = axios.create({
  baseURL: '/api/platform/admin',
});

platformApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

platformApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('platform_token');
      if (window.location.pathname !== '/platform/login') {
        window.location.href = '/platform/login';
      }
    }
    return Promise.reject(error);
  }
);
