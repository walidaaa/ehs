const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

interface TokenStore {
  accessToken: string | null;
  refreshToken: string | null;
}

let tokens: TokenStore = {
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
};

export const setTokens = (access: string | null, refresh: string | null) => {
  tokens.accessToken = access;
  tokens.refreshToken = refresh;
  if (access) {
    localStorage.setItem('accessToken', access);
  } else {
    localStorage.removeItem('accessToken');
  }
  if (refresh) {
    localStorage.setItem('refreshToken', refresh);
  } else {
    localStorage.removeItem('refreshToken');
  }
};

export const clearTokens = () => {
  tokens.accessToken = null;
  tokens.refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const getAccessToken = () => tokens.accessToken;

// Refresh token logic
let refreshPromise: Promise<boolean> | null = null;

const refreshAccessToken = async (): Promise<boolean> => {
  if (!tokens.refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
};

// Main fetch wrapper
export const apiFetch = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers || {}) as Record<string, string>),
  };

  if (tokens.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  let response = await fetch(url, { ...options, headers });

  // Handle token refresh on 401/403
  if ((response.status === 401 || response.status === 403) && tokens.refreshToken) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken();
    }

    const refreshed = await refreshPromise;
    refreshPromise = null;

    if (refreshed) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
      response = await fetch(url, { ...options, headers });
    }
  }

  if (!response.ok) {
    let errorMessage = 'Request failed';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    console.error(`[API] Error on ${endpoint}:`, errorMessage);
    throw new Error(errorMessage);
  }

  return response.json();
};

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const data = await apiFetch<{
      user: { id: string; email: string };
      profile: { full_name: string; phone?: string } | null;
      role: string | null;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  logout: () => {
    clearTokens();
  },

  getMe: async () => {
    return apiFetch<{
      user: { id: string; email: string };
      profile: { full_name: string; phone?: string } | null;
      role: string | null;
    }>('/auth/me');
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    return apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  changeAdminPassword: async (targetUserId: string, newPassword: string) => {
    return apiFetch('/auth/change-admin-password', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, newPassword }),
    });
  },

  createUser: async (data: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    role: string;
    specialty?: string;
    service_name?: string;
  }) => {
    return apiFetch<{ id: string; email: string; full_name: string; role: string }>(
      '/auth/create-user',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  deleteUser: async (id: string) => {
    return apiFetch(`/auth/users/${id}`, { method: 'DELETE' });
  },
};

// Generic CRUD API
export const crudApi = {
  // Custom endpoint call
  custom: async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    return apiFetch<T>(endpoint, options);
  },

  getAll: async <T = any>(table: string, filters?: Record<string, any>): Promise<T[]> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<T[]>(`/${table}${query}`);
  },

  getOne: async <T = any>(table: string, id: string): Promise<T> => {
    return apiFetch<T>(`/${table}/${id}`);
  },

  insert: async <T = any>(table: string, data: any): Promise<T> => {
    return apiFetch<T>(`/${table}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async <T = any>(table: string, id: string, data: any): Promise<T> => {
    return apiFetch<T>(`/${table}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (table: string, id: string): Promise<void> => {
    await apiFetch(`/${table}/${id}`, { method: 'DELETE' });
  },

  // Batch operations for patient_doctors
  deletePatientDoctors: async (patientId: string): Promise<void> => {
    await apiFetch(`/patient_doctors/by-patient/${patientId}`, { method: 'DELETE' });
  },

  insertPatientDoctorsBatch: async (rows: { patient_id: string; doctor_id: string }[]): Promise<void> => {
    await apiFetch('/patient_doctors/batch', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
};

export default { authApi, crudApi, apiFetch, setTokens, clearTokens, getAccessToken };
