const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/$/, '');

export const API_URL = `${API_BASE_URL}/api/vendor`;
