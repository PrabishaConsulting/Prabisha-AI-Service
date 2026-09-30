// src/modules/auth/guards/api-key.guard.ts
import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  UnauthorizedException, 
  HttpException, 
  HttpStatus 
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // 1. Extract the prefix (first 12 chars) to match your admin.service.ts logic
    const incomingPrefix = apiKey.slice(0, 12);

    // 2. Fetch all active keys that match this prefix
    // (This includes the fix for keys with infinite lifespans / expiresAt: null)
    const potentialKeys = await this.prisma.apiKey.findMany({
      where: {
        keyPrefix: incomingPrefix,
        status: 'ACTIVE',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: { user: true },
    });

    // 3. Initialize with 'any' to satisfy TypeScript strict null checks
    let apiKeyRecord: any = null;

    // 4. Use bcrypt to compare the incoming raw key against the stored hashes
    for (const key of potentialKeys) {
      const isMatch = await bcrypt.compare(apiKey, key.keyHash);
      if (isMatch) {
        apiKeyRecord = key;
        break;
      }
    }

    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    await this.enforceRateLimits(apiKeyRecord);

    // 5. Update last used timestamp and usage count
    await this.prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { 
        lastUsedAt: new Date(),
        usageCount: { increment: 1 }
      },
    });

    // 6. Attach user and apiKey info to request
    request.user = {
      id: apiKeyRecord.user.id,
      email: apiKeyRecord.user.email,
      role: apiKeyRecord.user.role,
      apiKeyId: apiKeyRecord.id,
    };
    
    return true;
  }

  private async enforceRateLimits(apiKey: {
    id: string;
    rpmLimit: number | null;
    rpdLimit: number | null;
  }) {
    if (apiKey.rpmLimit == null && apiKey.rpdLimit == null) return;

    const now = new Date();
    const minuteReset = new Date(now.getTime() + 60_000);
    const dayReset = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.rateLimitBucket.upsert({
        where: { apiKeyId: apiKey.id },
        create: {
          apiKeyId: apiKey.id,
          minuteCount: 0,
          dayCount: 0,
          minuteResetsAt: minuteReset,
          dayResetsAt: dayReset,
        },
        update: {},
      });

      await transaction.rateLimitBucket.updateMany({
        where: { apiKeyId: apiKey.id, minuteResetsAt: { lte: now } },
        data: { minuteCount: 0, minuteResetsAt: minuteReset },
      });
      await transaction.rateLimitBucket.updateMany({
        where: { apiKeyId: apiKey.id, dayResetsAt: { lte: now } },
        data: { dayCount: 0, dayResetsAt: dayReset },
      });

      if (apiKey.rpmLimit != null) {
        const updated = await transaction.rateLimitBucket.updateMany({
          where: { apiKeyId: apiKey.id, minuteCount: { lt: apiKey.rpmLimit } },
          data: { minuteCount: { increment: 1 } },
        });
        if (updated.count === 0) {
          throw new HttpException(
            'API key requests-per-minute limit exceeded', 
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
      }

      if (apiKey.rpdLimit != null) {
        const updated = await transaction.rateLimitBucket.updateMany({
          where: { apiKeyId: apiKey.id, dayCount: { lt: apiKey.rpdLimit } },
          data: { dayCount: { increment: 1 } },
        });
        if (updated.count === 0) {
          throw new HttpException(
            'API key requests-per-day limit exceeded', 
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
      }
    });
  }
}