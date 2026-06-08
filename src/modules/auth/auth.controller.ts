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
  async centralLogin(@Req() req: any, @Res() res: any) {
    console.log('Initiating Central Auth login flow strategy handshake');

    // Prevent concurrent double-clicks or browser pre-fetch links from corrupting session state
    const now = Date.now();
    if (req.session?.lastAuthInitiated && (now - req.session.lastAuthInitiated < 2500)) {
      console.warn('Blocked a rapid duplicate double-hit execution loop to protect session state');
      // Terminate the duplicate request immediately so it doesn't overwrite the original login state
      return res.status(429).send('Processing login request, please wait...');
    }

    // Initialize session structure if needed and drop the execution timestamp flag
    if (!req.session) req.session = {};
    req.session.lastAuthInitiated = now;

    // Passport's AuthGuard handles the automatic redirection to the authorization URL seamlessly
  }

  @Get('callback')
  @UseGuards(AuthGuard('central-auth'))
  async callback(@Req() req: any, @Res() res: any) {
    console.log('OAuth callback received successfully');
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