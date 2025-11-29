// Central authentication context storing the active user and helper actions.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { apiService } from '@/services/api';

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: 'dean' | 'admin' | 'coordinator' | 'student';
  school?: string;
  department?: string;
  designation?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Persist user session state and expose auth helper methods.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user session
    try {
      const storedUser = localStorage.getItem('auth_user');
      const storedToken = localStorage.getItem('auth_token');

      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      // Clear corrupted data
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { user, token } = await apiService.login(email, password);
      setUser(user);
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_token', token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid credentials';
      throw new Error(message);
    }
  };

  const register = async ({ name, email, password, role, school, department, designation }: RegisterPayload) => {
    try {
      const { user, token } = await apiService.register({ name, email, password, role, school, department, designation });
      setUser(user);
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_token', token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      throw new Error(message);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Convenience hook to consume the auth context with a helpful error.
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
