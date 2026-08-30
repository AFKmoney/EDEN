import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './AuthService';
import { TerminalService } from './TerminalService';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private auth = inject(AuthService);
  private router = inject(Router);
  private terminal = inject(TerminalService);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const isAuth = this.auth.isAuth();
    
    if (isAuth) {
      // Check if route requires specific role
      const requiredRole = route.data['role'] as 'user' | 'admin' | undefined;
      
      if (requiredRole && !this.auth.hasRole(requiredRole)) {
        this.terminal.log(`Auth: Insufficient permissions. Required: ${requiredRole}`, 'WARN');
        this.router.navigate(['/']);
        return false;
      }
      
      return true;
    }

    // Not authenticated, redirect to login
    this.terminal.log('Auth: Access denied. Redirecting to login.', 'WARN');
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: state.url }
    });
    
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class GuestGuard implements CanActivate {
  private auth = inject(AuthService);
  private router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const isAuth = this.auth.isAuth();
    
    // If authenticated, redirect to home
    if (isAuth) {
      this.router.navigate(['/']);
      return false;
    }
    
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  private auth = inject(AuthService);
  private router = inject(Router);
  private terminal = inject(TerminalService);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const isAuth = this.auth.isAuth();
    
    if (!isAuth) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: state.url }
      });
      return false;
    }

    const requiredRoles = route.data['roles'] as string[] | undefined;
    
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const hasRequiredRole = requiredRoles.some(role => this.auth.hasRole(role as 'user' | 'admin'));
    
    if (!hasRequiredRole) {
      this.terminal.log(`Auth: Insufficient permissions. Required one of: ${requiredRoles.join(', ')}`, 'WARN');
      this.router.navigate(['/']);
      return false;
    }
    
    return true;
  }
}
