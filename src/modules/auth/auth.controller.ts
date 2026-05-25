// src/modules/auth/auth.controller.ts
import { Controller, Get, Req, Res, UseGuards, Render } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('login')
  @Render('login')
  async loginPage(@Req() req: any) {
    // Clear any existing session
    if (req.session) {
      req.session.destroy();
    }
    return { 
      title: 'Login - AI Gateway Admin',
      layout: false
    };
  }

  @Get('central')
  @UseGuards(AuthGuard('central-auth'))
  async centralLogin() {
    console.log('Initiating Central Auth login flow');
    // The AuthGuard will automatically redirect to the external authorization URL
  }

  @Get('callback')
  @UseGuards(AuthGuard('central-auth'))
  async callback(@Req() req: any, @Res() res: any) {
    console.log('OAuth callback received');
    console.log('User object:', req.user);
    
    if (!req.user) {
      console.error('No user in request after OAuth callback');
      return res.redirect('/auth/central?error=auth_failed');
    }
    
    // Store user in session
    req.session.user = req.user;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/auth/central?error=session_error');
      }
      console.log('User authenticated successfully:', req.user.email);
      console.log('User role:', req.user.role);
      
      // Redirect based on role
      if (req.user.role === 'ADMIN') {
        return res.redirect('/admin/dashboard');
      }
      
      // For non-admin users, redirect to user portal (if exists) or show access denied
      return res.redirect('/auth/access-denied');
    });
  }

  @Get('logout')
  async logout(@Req() req: any, @Res() res: any) {
    req.session.destroy((err) => {
      if (err) console.error('Session destroy error:', err);
      res.redirect('/');
    });
  }
  
  @Get('access-denied')
  @Render('access-denied')
  async accessDenied() {
    return {
      title: 'Access Denied - AI Gateway',
      layout: false
    };
  }
}