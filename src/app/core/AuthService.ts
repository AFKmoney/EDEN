import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TerminalService } from './TerminalService';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role: 'user' | 'admin';
  createdAt: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private terminal = inject(TerminalService);

  // Auth state
  private authState = signal<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  public readonly state = this.authState.asReadonly();

  constructor() {
    this.initialize();
  }

  /**
   * Initialize auth state from localStorage
   */
  private initialize(): void {
    const token = localStorage.getItem('eden_token');
    const user = localStorage.getItem('eden_user');

    if (token && user) {
      try {
        const parsedUser = JSON.parse(user) as User;
        this.authState.set({
          user: parsedUser,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
        this.terminal.log('Auth: Restored session from localStorage', 'SYSTEM');
      } catch {
        this.logout();
      }
    } else {
      this.authState.set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuth(): boolean {
    return this.authState().isAuthenticated;
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.authState().user;
  }

  /**
   * Get auth token
   */
  getToken(): string | null {
    return this.authState().token;
  }

  /**
   * Get auth headers for HTTP requests
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
    this.authState.update(state => ({ ...state, isLoading: true, error: null }));

    try {
      // In production, this would call your backend API
      // For now, we'll use mock authentication
      const response = await this.mockLogin(credentials);

      if (!response.success) {
        this.authState.update(state => ({
          ...state,
          isLoading: false,
          error: response.error || 'Login failed'
        }));
        this.terminal.log(`Auth: Login failed - ${response.error}`, 'ERROR');
        return { success: false, error: response.error };
      }

      // Store token and user
      localStorage.setItem('eden_token', response.token!);
      localStorage.setItem('eden_user', JSON.stringify(response.user!));

      this.authState.set({
        user: response.user!,
        token: response.token!,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });

      this.terminal.log(`Auth: Login successful - ${response.user?.email}`, 'SYSTEM');
      return { success: true };
      
    } catch (error: any) {
      this.authState.update(state => ({
        ...state,
        isLoading: false,
        error: error.message || 'Login failed'
      }));
      this.terminal.log(`Auth: Login error - ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  /**
   * Register new user
   */
  async register(credentials: RegisterCredentials): Promise<{ success: boolean; error?: string }> {
    this.authState.update(state => ({ ...state, isLoading: true, error: null }));

    try {
      const response = await this.mockRegister(credentials);

      if (!response.success) {
        this.authState.update(state => ({
          ...state,
          isLoading: false,
          error: response.error || 'Registration failed'
        }));
        this.terminal.log(`Auth: Registration failed - ${response.error}`, 'ERROR');
        return { success: false, error: response.error };
      }

      // Auto-login after registration
      return this.login({ email: credentials.email, password: credentials.password });
      
    } catch (error: any) {
      this.authState.update(state => ({
        ...state,
        isLoading: false,
        error: error.message || 'Registration failed'
      }));
      this.terminal.log(`Auth: Registration error - ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  /**
   * Logout user
   */
  logout(): void {
    localStorage.removeItem('eden_token');
    localStorage.removeItem('eden_user');

    this.authState.set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });

    this.terminal.log('Auth: Logout successful', 'SYSTEM');
    this.router.navigate(['/']);
  }

  /**
   * Clear auth error
   */
  clearError(): void {
    this.authState.update(state => ({ ...state, error: null }));
  }

  /**
   * Check if user has role
   */
  hasRole(role: 'user' | 'admin'): boolean {
    const user = this.getUser();
    if (!user) return false;
    return user.role === role || user.role === 'admin';
  }

  /**
   * Get user role
   */
  getRole(): 'user' | 'admin' | null {
    const user = this.getUser();
    return user?.role || null;
  }

  // ============================================
  // Mock Authentication (Replace with real API calls)
  // ============================================

  private async mockLogin(credentials: LoginCredentials): Promise<{
    success: boolean;
    error?: string;
    user?: User;
    token?: string;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simple validation
    if (!credentials.email || !credentials.password) {
      return { success: false, error: 'Email and password are required' };
    }

    // Mock user database
    const mockUsers: User[] = [
      {
        id: 'user_1',
        email: 'demo@eden.dev',
        name: 'Demo User',
        role: 'user',
        createdAt: Date.now()
      },
      {
        id: 'user_2',
        email: 'admin@eden.dev',
        name: 'Admin User',
        role: 'admin',
        createdAt: Date.now()
      }
    ];

    const user = mockUsers.find(u => u.email === credentials.email);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // In real implementation, verify password hash
    // For mock, accept any non-empty password
    if (!credentials.password) {
      return { success: false, error: 'Invalid password' };
    }

    // Generate mock token
    const token = `mock_token_${user.id}_${Date.now()}`;

    return {
      success: true,
      user,
      token
    };
  }

  private async mockRegister(credentials: RegisterCredentials): Promise<{
    success: boolean;
    error?: string;
    user?: User;
    token?: string;
  }> {
    await new Promise(resolve => setTimeout(resolve, 500));

    if (!credentials.email || !credentials.password || !credentials.name) {
      return { success: false, error: 'All fields are required' };
    }

    // Check if user already exists
    const existingUsers = JSON.parse(localStorage.getItem('eden_mock_users') || '[]') as User[];
    if (existingUsers.some(u => u.email === credentials.email)) {
      return { success: false, error: 'User already exists' };
    }

    // Create new user
    const newUser: User = {
      id: `user_${Date.now()}`,
      email: credentials.email,
      name: credentials.name,
      role: 'user',
      createdAt: Date.now()
    };

    existingUsers.push(newUser);
    localStorage.setItem('eden_mock_users', JSON.stringify(existingUsers));

    const token = `mock_token_${newUser.id}_${Date.now()}`;

    return {
      success: true,
      user: newUser,
      token
    };
  }

  // ============================================
  // JWT Token Management (For real backend)
  // ============================================

  /**
   * Decode JWT token (client-side only)
   */
  decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
  }

  /**
   * Refresh token
   */
  async refreshToken(): Promise<{ success: boolean; error?: string }> {
    const currentToken = this.getToken();
    if (!currentToken) {
      return { success: false, error: 'No token to refresh' };
    }

    // In real implementation, call refresh endpoint
    // For mock, just return current token
    return { success: true };
  }
}
