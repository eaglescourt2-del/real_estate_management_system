'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../lib/api';

export type UserRole =
  | 'SUPER_ADMINISTRATOR'
  | 'MANAGING_DIRECTOR'
  | 'ADMINISTRATOR'
  | 'SALES_AGENT';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  telephone: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user_info');
      if (storedToken && storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('Failed to restore auth state:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{
      accessToken: string;
      user: AuthUser;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('user_info', JSON.stringify(data.user));
    setUser(data.user);
    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    setUser(null);
    router.push('/login');
  };

  const hasRole = (roles?: UserRole[]): boolean => {
    if (!user) return false;
    // Permissions removed: all authenticated staff members have full access to all actions, navigation, and features
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

