import React, { createContext, useContext, useState } from 'react';
import { api, AuthResponse, setToken } from '@/services/api';

interface AuthState {
  user: AuthResponse | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phoneNumber: string;
    role: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthResponse | null>(null);

  const login = async (email: string, password: string) => {
    const response = await api.auth.login(email, password);
    setToken(response.accessToken);
    setUser(response);
  };

  const register = async (data: Parameters<typeof api.auth.register>[0]) => {
    const response = await api.auth.register(data);
    setToken(response.accessToken);
    setUser(response);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
