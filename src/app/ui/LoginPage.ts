import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../core/AuthService';
import { TerminalService } from '../core/TerminalService';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-2">
            EDEN
          </div>
          <p class="text-slate-400 text-sm">
            Visual AI Graph IDE with Ternary VM
          </p>
        </div>

        <!-- Login Form -->
        <div class="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700/50 shadow-2xl shadow-cyan-500/5">
          <h2 class="text-2xl font-bold text-white mb-6">Sign In</h2>

          <!-- Error Message -->
          @if (auth.state().error) {
            <div class="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {{ auth.state().error }}
            </div>
          }

          <form (ngSubmit)="onLogin()" class="space-y-4">
            <!-- Email -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-300 flex items-center gap-2" for="login-email">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="Enter your email"
                class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                required
                autocomplete="email"
              />
            </div>

            <!-- Password -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-300 flex items-center gap-2" for="login-password">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                Password
              </label>
              <input
                id="login-password"
                type="password"
                [(ngModel)]="password"
                name="password"
                placeholder="Enter your password"
                class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                required
                autocomplete="current-password"
              />
            </div>

            <!-- Forgot Password & Remember Me -->
            <div class="flex items-center justify-between text-sm">
              <label class="flex items-center gap-2 text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  [(ngModel)]="rememberMe"
                  name="rememberMe"
                  class="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                class="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              [disabled]="auth.state().isLoading"
              class="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-xl hover:from-cyan-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30"
            >
              @if (auth.state().isLoading) {
                <svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              } @else {
                Sign In
              }
            </button>
          </form>

          <!-- Divider -->
          <div class="my-6 flex items-center gap-4">
            <div class="flex-1 h-px bg-slate-600"></div>
            <span class="text-slate-400 text-sm">or</span>
            <div class="flex-1 h-px bg-slate-600"></div>
          </div>

          <!-- Social Login Buttons -->
          <div class="space-y-3">
            <button
              type="button"
              class="w-full py-3 px-4 bg-slate-700/50 border border-slate-600 rounded-xl text-white font-medium hover:bg-slate-600/50 transition-all flex items-center justify-center gap-3"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
              </svg>
              Continue with GitHub
            </button>
            <button
              type="button"
              class="w-full py-3 px-4 bg-slate-700/50 border border-slate-600 rounded-xl text-white font-medium hover:bg-slate-600/50 transition-all flex items-center justify-center gap-3"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Continue with Discord
            </button>
          </div>

          <!-- Sign Up Link -->
          <p class="text-center text-slate-400 mt-6">
            Don't have an account?
            <a
              [routerLink]="['/register']"
              class="text-cyan-400 hover:text-cyan-300 font-medium ml-1"
            >
              Sign Up
            </a>
          </p>
        </div>

        <!-- Decorative Elements -->
        <div class="absolute top-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div class="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `],
  animations: []
})
export class LoginPage {
  auth = inject(AuthService);
  router = inject(Router);
  terminal = inject(TerminalService);

  email = '';
  password = '';
  rememberMe = false;

  constructor() {
    // Redirect if already authenticated
    if (this.auth.isAuth()) {
      this.router.navigate(['/']);
    }
  }

  async onLogin(): Promise<void> {
    if (!this.email || !this.password) {
      return;
    }

    const result = await this.auth.login({
      email: this.email,
      password: this.password
    });

    if (result.success) {
      this.terminal.log(`Login: Successful - ${this.email}`, 'SYSTEM');
      
      // Redirect to home or return URL
      const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
      this.router.navigate([returnUrl || '/']);
    }
  }
}
