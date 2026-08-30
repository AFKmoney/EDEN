import {Routes} from '@angular/router';
import { LoginPage } from './ui/LoginPage';
import { RegisterPage } from './ui/RegisterPage';
import { ProfilePage } from './ui/ProfilePage';
import { TemplateMarketplace } from './ui/TemplateMarketplace';
import { AuthGuard, GuestGuard } from './core/AuthGuard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage,
    canActivate: [GuestGuard]
  },
  {
    path: 'register',
    component: RegisterPage,
    canActivate: [GuestGuard]
  },
  {
    path: 'profile',
    component: ProfilePage,
    canActivate: [AuthGuard]
  },
  {
    path: 'marketplace',
    component: TemplateMarketplace
  },
  {
    path: 'marketplace/:id',
    component: TemplateMarketplace
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/'
  },
  {
    path: '**',
    redirectTo: '/'
  }
];
