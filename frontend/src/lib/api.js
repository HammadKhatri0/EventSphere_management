import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const ASSET_BASE = import.meta.env.VITE_ASSET_BASE || '';

/** Resolve a stored upload path (e.g. /uploads/abc.png) to a loadable URL. */
export const assetUrl = (p) => (!p ? '' : /^https?:/i.test(p) ? p : `${ASSET_BASE}${p}`);

// The access token lives in memory only (never localStorage) to limit XSS exposure;
// the refresh token is an httpOnly cookie managed by the server.
let accessToken = null;
let onSessionLost = () => {};
export const getAccessToken = () => accessToken;
export const setAccessToken = (t) => { accessToken = t; };
export const setSessionLostHandler = (fn) => { onSessionLost = fn; };

export const api = axios.create({ baseURL: BASE_URL, withCredentials: true, timeout: 20000 });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing = null;
export const refreshSession = () => {
  // single-flight: concurrent 401s share one refresh request
  refreshing ||= axios
    .post(`${BASE_URL}/auth/refresh`, null, { withCredentials: true, timeout: 20000 })
    .then((r) => { accessToken = r.data.data.accessToken; return r.data.data; })
    .finally(() => { refreshing = null; });
  return refreshing;
};

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = /\/auth\/(login|register|refresh|logout|forgot-password|reset-password)/.test(config?.url || '');
    if (response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        await refreshSession();
        config.headers.Authorization = `Bearer ${accessToken}`;
        return api(config);
      } catch {
        accessToken = null;
        onSessionLost();
      }
    }
    return Promise.reject(error);
  }
);

/** GET helper for react-query: unwraps { success, data }. */
export const get = (url, params) => api.get(url, { params }).then((r) => r.data.data);
export const post = (url, body) => api.post(url, body).then((r) => r.data);
export const patch = (url, body) => api.patch(url, body).then((r) => r.data);
export const put = (url, body) => api.put(url, body).then((r) => r.data);
export const del = (url, body) => api.delete(url, { data: body }).then((r) => r.data);

export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  return fallback;
};

/** Field-level validation errors from the API as { field: message }. */
export const fieldErrors = (err) =>
  Object.fromEntries((err?.response?.data?.errors || []).map((e) => [e.field, e.message]));

export async function uploadFile(file, kind = 'image') {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post(`/uploads/${kind}`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
  return res.data.data; // { url, name, size }
}
