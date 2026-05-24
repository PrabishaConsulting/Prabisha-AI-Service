import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import session from 'express-session';
import passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Session configuration (from your working project)
  app.use(
    session({
      name: 'AI_GATEWAY_SESSION',
      secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
      resave: true,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
      },
    }),
  );

  // Request logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
    next();
  });

  // Passport initialization
  app.use(passport.initialize());
  app.use(passport.session());

  // Setup views and static files
  const viewsDir = join(process.cwd(), 'views');
  const publicDir = join(process.cwd(), 'public');

  // Register helpers using the hbs instance (your working method)
  const hbs = require('hbs');
  
  // Register partials
  hbs.registerPartials(join(process.cwd(), 'views/partials'));
  
  // Register helpers
  hbs.registerHelper('formatNumber', (num) => {
    return num?.toLocaleString() || '0';
  });
  
  hbs.registerHelper('formatTime', (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  });
  
  hbs.registerHelper('formatDate', (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  });
  
  hbs.registerHelper('json', (context) => {
    return JSON.stringify(context);
  });
  
  hbs.registerHelper('statusClass', (status) => {
    const classes: Record<string, string> = {
      SUCCESS: 'active',
      FAILED: 'error',
      FALLBACK_USED: 'warning',
      CACHED: 'active',
      ACTIVE: 'active',
      INACTIVE: 'inactive',
      REVOKED: 'error',
      EXPIRED: 'warning'
    };
    return classes[status] || 'inactive';
  });
  
  hbs.registerHelper('eq', (a, b) => {
    return a === b;
  });
  
  hbs.registerHelper('includes', (array, item) => {
    return array?.includes(item);
  });
  
  hbs.registerHelper('initial', (name) => {
    if (!name || typeof name !== 'string') return '?';
    return name.charAt(0).toUpperCase();
  });
  
  hbs.registerHelper('truncate', (str, length) => {
    if (!str) return '';
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  });

  // NEW: avatarColor helper - generates consistent colors for user avatars
  hbs.registerHelper('avatarColor', (email) => {
    if (!email) return '#8b5cf6'; // Default purple color
    
    // Generate a consistent color based on email string
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate HSL color with good saturation and lightness
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 60%)`;
  });

  // NEW: formatStatus helper for better status display
  hbs.registerHelper('formatStatus', (status) => {
    const statusMap: Record<string, string> = {
      SUCCESS: 'Success',
      FAILED: 'Failed',
      FALLBACK_USED: 'Fallback Used',
      CACHED: 'Cached',
      ACTIVE: 'Active',
      INACTIVE: 'Inactive',
      REVOKED: 'Revoked',
      EXPIRED: 'Expired',
      RATE_LIMITED: 'Rate Limited',
      ERROR: 'Error'
    };
    return statusMap[status] || status;
  });

  // NEW: percentage helper for calculations
  hbs.registerHelper('percentage', (value, total) => {
    if (!total || total === 0) return '0%';
    const percent = (value / total) * 100;
    return `${Math.round(percent)}%`;
  });

  // NEW: multiply helper for calculations
  hbs.registerHelper('multiply', (a, b) => {
    return a * b;
  });

  // NEW: subtract helper for calculations
  hbs.registerHelper('subtract', (a, b) => {
    return a - b;
  });

  // NEW: or helper for conditional logic
  hbs.registerHelper('or', (a, b) => {
    return a || b;
  });

  // NEW: and helper for conditional logic
  hbs.registerHelper('and', (a, b) => {
    return a && b;
  });

  // NEW: formatCost helper for displaying currency
  hbs.registerHelper('formatCost', (cost) => {
    if (!cost && cost !== 0) return '$0.00';
    return `$${cost.toFixed(4)}`;
  });

  hbs.registerHelper('getProviderIcon', function (providerName: string) {
    const icons: Record<string, string> = {
      'OPENAI': 'fa-openai',
      'ANTHROPIC': 'fa-robot',
      'GEMINI': 'fa-google',
      'MISTRAL': 'fa-wind',
      'COHERE': 'fa-coins',
    };
    // FontAwesome 6 brands framework uses 'fab' prefix for specific brand icons
    const icon = icons[providerName] || 'fa-cloud';
    const prefix = ['fa-openai', 'fa-google'].includes(icon) ? 'fab' : 'fas';
    
    return `${prefix} ${icon}`;
  });

  hbs.registerHelper('isExpired', (date) => {
    if (!date) return false;
    return new Date(date) < new Date();
  });

  // Configure view engine
  app.engine('hbs', hbs.__express);
  app.setBaseViewsDir(viewsDir);
  app.setViewEngine('hbs');
  app.useStaticAssets(publicDir);

  // IMPORTANT: DO NOT set global prefix for views
  // Only prefix API routes, but we'll handle that in controllers
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application running on: http://localhost:3000`);
  console.log(`Login page: http://localhost:3000/auth/login`);
  console.log(`Admin dashboard: http://localhost:3000/admin/dashboard`);
}

bootstrap();