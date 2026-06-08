// src/modules/auth/auth.controller.ts
import { Controller, Get, Req, Res, UseGuards, Render, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginThrottlerInterceptor } from './interceptors/login-throttler.interceptor';

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

  // Bind the interceptor here to safeguard the route from double-firing
  @Get('central')
  @UseInterceptors(LoginThrottlerInterceptor)
  @UseGuards(AuthGuard('central-auth'))
  async centralLogin() {
    console.log(`[${new Date().toLocaleTimeString()}] Handing off control safely to Central Auth`);
    // Passport's AuthGuard handles the redirection loop seamlessly from here
  }

  @Get('callback')
  @UseGuards(AuthGuard('central-auth'))
  async callback(@Req() req: any, @Res() res: any) {
    console.log('OAuth callback received');
    
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