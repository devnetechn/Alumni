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
