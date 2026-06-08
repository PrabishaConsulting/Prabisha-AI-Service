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
    if (req.session) {
      req.session.destroy();
    }
    return { 
      title: 'Login - AI Gateway Admin',
      layout: false
    };
  }

  @Get('central')
  async centralLoginInitiator(@Req() req: any, @Res() res: any, next: any) {
    console.log(`[${new Date().toLocaleTimeString()}] Root check for /auth/central execution`);

    // 1. Prevent concurrent double-clicks or pre-fetch triggers from destroying OIDC session state
    const now = Date.now();
    if (req.session?.lastAuthInitiated && (now - req.session.lastAuthInitiated < 2000)) {
      console.warn('Blocked a rapid duplicate double-hit execution loop to protect session state');
      
      // If it's an immediate duplicate, stop processing right here.
      return res.status(429).send('Processing login request, please wait...');
    }

    // Mark current session timestamp execution layer
    if (!req.session) req.session = {};
    req.session.lastAuthInitiated = now;

    // Explicitly pass execution sequence down directly into the passport pipeline manually
    next();
  }

  // Bind the actual passport guard step sequentially right after the throttling initiator
  @Get('central')
  @UseGuards(AuthGuard('central-auth'))
  async centralLogin() {
    console.log('Initiating Central Auth login flow strategy handshake');
  }

  @Get('callback')
  @UseGuards(AuthGuard('central-auth'))
  async callback(@Req() req: any, @Res() res: any) {
    console.log('OAuth callback received successfully');
    
    if (!req.user) {
      console.error('No user in request after OAuth callback');
      return res.redirect('/auth/central?error=auth_failed');
    }
    
    req.session.user = req.user;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/auth/central?error=session_error');
      }
      
      if (req.user.role === 'ADMIN') {
        return res.redirect('/admin/dashboard');
      }
      return res.redirect('/auth/access-denied');
    });
  }
}