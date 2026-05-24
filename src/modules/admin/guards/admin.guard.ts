// admin/guards/admin.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // Check session for user
    let user = request.session?.user;
    
    if (!user) {
      // For API requests, return 401
      if (request.url.startsWith('/api/')) {
        throw new UnauthorizedException('Not authenticated');
      }
      // For view requests, redirect to login
      response.redirect('/auth/login');
      return false;
    }

    // Verify user exists and is admin in database
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser || dbUser.role !== 'ADMIN') {
      request.session.destroy();
      response.redirect('/auth/login');
      return false;
    }

    // Attach user to request
    request.user = dbUser;
    return true;
  }
}