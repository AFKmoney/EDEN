import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../core/AuthService';
import { TerminalService } from '../core/TerminalService';

@Component({
  selector: 'app-register-page',
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
            Create your account and start building AI agents
          </p>
        </div>

        <!-- Register Form -->
        <div class="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700/50 shadow-2xl shadow-purple-500/5">
          <h2 class="text-2xl font-bold text-white mb-6">Create Account</h2>

          <!-- Error Message -->
          @if (auth.state().error) {
            <div class="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {{ auth.state().error }}
            </div>
          }

          <form (ngSubmit)="onRegister()" class="space-y-4">
            <!-- Name -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-300 flex items-center gap-2" for="register-name">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Full Name
              </label>
              <input
                id="register-name"
                type="text"
                [(ngModel)]="name"
                name="name"
                placeholder="Enter your full name"
                class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                required
                autocomplete="name"
              />
            </div>

            <!-- Email -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-300 flex items-center gap-2" for="register-email">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002-2v10a2 2 0 002 2z"/>
                </svg>
                Email Address
              </label>
              <input
                id="register-email"
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="Enter your email"
                class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                required
                autocomplete="email"
              />
            </div>

            <!-- Password -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-300 flex items-center gap-2" for="register-password">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                Password
              </label>
              <div class="relative">
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  [(ngModel)]="password"
                  name="password"
                  placeholder="Create a strong password"
                  class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12"
                  required
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  (click)="showPassword = !showPassword"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  @if (showPassword) {
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  } @else {
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                    </svg>
                  }
                </button>
              </div>
              <div class="text-xs text-slate-500 mt-1">
                <div class="flex gap-2">
                  <span [class.text-green-400]="hasMinLength" [class.text-slate-500]="!hasMinLength">✓ At least 8 characters</span>
                  <span [class.text-green-400]="hasNumber" [class.text-slate-500]="!hasNumber">✓ Contains a number</span>
                </div>
                <div class="flex gap-2">
                  <span [class.text-green-400]="hasSpecialChar" [class.text-slate-500]="!hasSpecialChar">✓ Special character</span>
                </div>
              </div>
            </div>

            <!-- Confirm Password -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-300 flex items-center gap-2" for="register-confirm-password">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Confirm Password
              </label>
              <input
                id="register-confirm-password"
                [type]="showConfirmPassword ? 'text' : 'password'"
                [(ngModel)]="confirmPassword"
                name="confirmPassword"
                placeholder="Confirm your password"
                class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                required
                autocomplete="new-password"
              />
              @if (password && confirmPassword && password !== confirmPassword) {
                <p class="text-red-400 text-xs mt-1">Passwords do not match</p>
              }
            </div>

            <!-- Terms -->
            <label class="flex items-start gap-3 text-sm text-slate-400 cursor-pointer" for="register-terms">
              <input
                id="register-terms"
                type="checkbox"
                [(ngModel)]="acceptTerms"
                name="acceptTerms"
                class="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500 mt-1 flex-shrink-0"
                required
              />
              <span>
                I agree to the
                <a class="text-purple-400 hover:text-purple-300" href="#">Terms of Service</a>
                and
                <a class="text-purple-400 hover:text-purple-300" href="#">Privacy Policy</a>
              </span>
            </label>

            <!-- Submit Button -->
            <button
              type="submit"
              [disabled]="auth.state().isLoading || !isFormValid()"
              class="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30"
            >
              @if (auth.state().isLoading) {
                <svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              } @else {
                Create Account
              }
            </button>
          </form>

          <!-- Divider -->
          <div class="my-6 flex items-center gap-4">
            <div class="flex-1 h-px bg-slate-600"></div>
            <span class="text-slate-400 text-sm">or</span>
            <div class="flex-1 h-px bg-slate-600"></div>
          </div>

          <!-- Social Register Buttons -->
          <div class="space-y-3">
            <button
              type="button"
              class="w-full py-3 px-4 bg-slate-700/50 border border-slate-600 rounded-xl text-white font-medium hover:bg-slate-600/50 transition-all flex items-center justify-center gap-3"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
              </svg>
              Sign up with GitHub
            </button>
            <button
              type="button"
              class="w-full py-3 px-4 bg-slate-700/50 border border-slate-600 rounded-xl text-white font-medium hover:bg-slate-600/50 transition-all flex items-center justify-center gap-3"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Sign up with Discord
            </button>
          </div>

          <!-- Login Link -->
          <p class="text-center text-slate-400 mt-6">
            Already have an account?
            <a
              [routerLink]="['/login']"
              class="text-purple-400 hover:text-purple-300 font-medium ml-1"
            >
              Sign In
            </a>
          </p>
        </div>

        <!-- Decorative Elements -->
        <div class="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
        <div class="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2"></div>
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
export class RegisterPage {
  auth = inject(AuthService);
  router = inject(Router);
  terminal = inject(TerminalService);

  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;
  acceptTerms = false;

  constructor() {
    // Redirect if already authenticated
    if (this.auth.isAuth()) {
      this.router.navigate(['/']);
    }
  }

  get hasMinLength(): boolean {
    return this.password.length >= 8;
  }

  get hasNumber(): boolean {
    return /\d/.test(this.password);
  }

  get hasSpecialChar(): boolean {
    return /[!@#$%^&*(),.?":{}|<>]/.test(this.password);
  }

  isFormValid(): boolean {
    return !!this.name && 
           !!this.email && 
           !!this.password && 
           this.password === this.confirmPassword &&
           this.acceptTerms &&
           this.hasMinLength &&
           this.hasNumber &&
           this.hasSpecialChar;
  }

  async onRegister(): Promise<void> {
    if (!this.isFormValid()) {
      return;
    }

    const result = await this.auth.register({
      name: this.name,
      email: this.email,
      password: this.password
    });

    if (result.success) {
      this.terminal.log(`Register: Successful - ${this.email}`, 'SYSTEM');
      
      // Redirect to home or return URL
      const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
      this.router.navigate([returnUrl || '/']);
    }
  }
}
