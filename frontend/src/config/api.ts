/**
 * Centralized API configuration.
 * Uses Vite environment variables — never hardcode localhost here.
 */
const API_URL = import.meta.env.VITE_API_URL || '';

export const FRONTEND_URL =
  import.meta.env.VITE_FRONTEND_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export const ENV = import.meta.env.VITE_ENV || 'production';

export default API_URL;
