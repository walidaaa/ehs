// API Client for local backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const getAccessToken = () => {
  // Try multiple token keys - 'accessToken' is the primary one from auth context
  return localStorage.getItem('accessToken') || localStorage.getItem(TOKEN_KEY);
};

export const setTokens = (token: string, user: any) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getStoredUser = () => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};

const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearTokens();
    window.location.href = '/login';
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }

  return data;
};

export const authApi = {
  login: async (email: string, password: string) => {
    const data = await makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setTokens(data.token, data.user);
    return data;
  },

  logout: () => {
    clearTokens();
  },

  getMe: async () => {
    return makeRequest('/auth/me', { method: 'GET' });
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    return makeRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },
};

// CRUD API - Generic handler
export const crudApi = {
  // Read all
  getAll: async (table: string, params?: any) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query.append(key, String(value));
        }
      });
    }
    const queryString = query.toString();
    return makeRequest(`/${table}${queryString ? '?' + queryString : ''}`, { method: 'GET' });
  },

  // Read one
  getOne: async (table: string, id: string) => {
    return makeRequest(`/${table}/${id}`, { method: 'GET' });
  },

  // Create
  create: async (table: string, data: any) => {
    return makeRequest(`/${table}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update
  update: async (table: string, id: string, data: any) => {
    return makeRequest(`/${table}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete
  delete: async (table: string, id: string) => {
    return makeRequest(`/${table}/${id}`, { method: 'DELETE' });
  },

  // Custom endpoint
  custom: async (endpoint: string, options: RequestInit = {}) => {
    return makeRequest(endpoint, options);
  },
};

// Upload media (images, voice)
// Uses the accessToken from the main api.ts auth flow (stored as 'accessToken' in localStorage)
export const uploadMedia = async (file: File): Promise<string> => {
  console.log('[uploadMedia] Starting upload for file:', file.name, 'size:', file.size, 'type:', file.type);
  // Use the correct token key - the main auth stores it as 'accessToken', not 'auth_token'
  const token = localStorage.getItem('accessToken') || getAccessToken();
  console.log('[uploadMedia] Token available:', !!token);
  
  // Read file as base64 and send as JSON (simpler approach)
  const reader = new FileReader();
  
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        console.log('[uploadMedia] Base64 data length:', base64Data?.length);
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        console.log('[uploadMedia] Sending request to:', `${API_URL}/upload`);
        const response = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            data: base64Data,
          }),
        });

        console.log('[uploadMedia] Response status:', response.status);

        if (response.status === 401) {
          clearTokens();
          window.location.href = '/login';
          reject(new Error('Unauthorized'));
          return;
        }

        const data = await response.json();
        console.log('[uploadMedia] Response data:', data);

        if (!response.ok) {
          console.error('[uploadMedia] Error response:', data);
          reject(new Error(data.message || data.error || `HTTP ${response.status}`));
          return;
        }

        console.log('[uploadMedia] Upload successful, URL:', data.url);
        resolve(data.url);
      } catch (error) {
        console.error('[uploadMedia] Catch error:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => {
      console.error('[uploadMedia] FileReader error');
      reject(new Error('Failed to read file'));
    };
    
    console.log('[uploadMedia] Starting FileReader.readAsDataURL');
    reader.readAsDataURL(file);
  });
};

export default {
  authApi,
  crudApi,
  uploadMedia,
};
