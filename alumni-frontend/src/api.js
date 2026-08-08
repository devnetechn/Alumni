import axios from 'axios';

// Same-origin: /api proxied to backend by Vite in dev, and by reverse proxy in prod.
export const API_BASE = '';

export const api = axios.create({
  baseURL: '/api',
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
    if (error.response && error.response.status === 402 && trialExpiredHandler) {
      trialExpiredHandler(error.response.data);
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
