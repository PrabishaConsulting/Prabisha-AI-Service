// src/modules/auth/guards/api-key.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Hash the incoming key for comparison
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    const apiKeyRecord = await this.prisma.apiKey.findFirst({
      where: {
        keyHash: hashedKey,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    // Update last used timestamp
    await this.prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { 
        lastUsedAt: new Date(),
        usageCount: { increment: 1 }
      },
    });

    // Attach user and apiKey info to request
    request.user = {
      id: apiKeyRecord.user.id,
      email: apiKeyRecord.user.email,
      role: apiKeyRecord.user.role,
      apiKeyId: apiKeyRecord.id,
    };
    
    return true;
  }
}