// src/modules/admin/admin.service.ts
import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderName, ProviderStatus, ApiKeyStatus, ApiKeyScope, Modality } from 'src/generated/prisma/enums';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Get encryption key from environment (must be 32 bytes for AES-256)
    const key = this.configService.get('ENCRYPTION_KEY');
    if (!key || key.length !== 64) {
      this.logger.warn('ENCRYPTION_KEY not set or invalid. Using development key.');
      this.encryptionKey = crypto.randomBytes(32);
    } else {
      this.encryptionKey = Buffer.from(key, 'hex');
    }
  }

  async encryptApiKey(apiKey: string): Promise<{ encryptedKey: string; iv: string; authTag: string }> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return {
      encryptedKey: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag,
    };
  }

  async decryptApiKey(encryptedKey: string, iv: string, authTag: string): Promise<string> {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async createProvider(data: {
    name: string;
    displayName: string;
    priority: number;
    baseUrl?: string;
    supportedModalities: string[];
  }) {
    // Check if provider already exists
    const existing = await this.prisma.provider.findUnique({
      where: { name: data.name as ProviderName },
    });
    
    if (existing) {
      throw new Error(`Provider ${data.name} already exists`);
    }
    
    return this.prisma.provider.create({
      data: {
        name: data.name as ProviderName,
        displayName: data.displayName,
        priority: data.priority || 100,
        baseUrl: data.baseUrl,
        supportedModalities: data.supportedModalities as Modality[],
        status: ProviderStatus.INACTIVE,
        isEnabled: true,
        encryptedKey: '',
        keyIv: '',
        keyTag: '',
      },
    });
  }

  async updateProvider(id: string, data: {
    displayName?: string;
    priority?: number;
    baseUrl?: string;
    supportedModalities?: string[];
  }) {
    return this.prisma.provider.update({
      where: { id },
      data: {
        displayName: data.displayName,
        priority: data.priority,
        baseUrl: data.baseUrl,
        supportedModalities: data.supportedModalities as Modality[],
        updatedAt: new Date(),
      },
    });
  }

  async deleteProvider(id: string) {
    // Check if provider has usage logs
    const usageCount = await this.prisma.usageLog.count({
      where: { providerId: id },
    });
    
    if (usageCount > 0) {
      throw new Error(`Cannot delete provider with ${usageCount} usage logs. Consider deactivating instead.`);
    }
    
    return this.prisma.provider.delete({
      where: { id },
    });
  }

  async getProvider(id: string) {
    return this.prisma.provider.findUnique({
      where: { id },
      include: { models: true },
    });
  }

  async testProviderConnection(providerId: string, testApiKey?: string): Promise<{ success: boolean; message: string }> {
    try {
      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId },
      });

      if (!provider) {
        return { success: false, message: 'Provider not found' };
      }

      let apiKeyToTest = testApiKey;
      
      if (!apiKeyToTest) {
        // Decrypt existing key
        apiKeyToTest = await this.decryptApiKey(provider.encryptedKey, provider.keyIv, provider.keyTag);
      }

      // Test connection based on provider type
      switch (provider.name) {
        case 'OPENAI':
          return await this.testOpenAIConnection(apiKeyToTest);
        case 'ANTHROPIC':
          return await this.testAnthropicConnection(apiKeyToTest);
        case 'GEMINI':
          return await this.testGeminiConnection(apiKeyToTest);
        case 'MISTRAL':
          return await this.testMistralConnection(apiKeyToTest);
        default:
          return { success: false, message: 'Unknown provider type' };
      }
    } catch (error) {
      this.logger.error(`Provider test failed: ${error}`);
      return { success: false, message: error as string };
    }
  }

  private async testOpenAIConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      if (response.ok) {
        return { success: true, message: 'Connection successful! API key is valid.' };
      } else {
        const error = await response.json();
        return { success: false, message: `Connection failed: ${error.error || 'Invalid API key'}` };
      }
    } catch (error) {
      return { success: false, message: `Connection error: ${error}` };
    }
  }

  private async testAnthropicConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      
      if (response.ok || response.status === 401) {
        return { success: true, message: 'Connection successful!' };
      } else {
        return { success: false, message: 'Invalid API key' };
      }
    } catch (error) {
      return { success: false, message: `Connection error: ${error}` };
    }
  }

  private async testGeminiConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      
      if (response.ok) {
        return { success: true, message: 'Connection successful! API key is valid.' };
      } else {
        return { success: false, message: 'Invalid API key' };
      }
    } catch (error) {
      return { success: false, message: `Connection error: ${error}` };
    }
  }

  private async testMistralConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('https://api.mistral.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      if (response.ok) {
        return { success: true, message: 'Connection successful! API key is valid.' };
      } else {
        return { success: false, message: 'Invalid API key' };
      }
    } catch (error) {
      return { success: false, message: `Connection error: ${error}` };
    }
  }

  async getDashboardStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: 'ADMIN' },
    });
    if (!user) throw new ForbiddenException('Admin access required');

    const [totalCalls, activeKeys, providers, costData] = await Promise.all([
      this.prisma.usageLog.count(),
      this.prisma.apiKey.count({ where: { status: ApiKeyStatus.ACTIVE } }),
      this.prisma.provider.findMany(),
      this.prisma.usageLog.aggregate({
        _sum: { estimatedCostUsd: true },
        where: {
          createdAt: { gte: new Date(new Date().setDate(1)) },
        },
      }),
    ]);

    const totalCost = await this.prisma.usageLog.aggregate({
      _sum: { estimatedCostUsd: true },
    });

    return {
      totalCalls,
      activeKeys,
      activeProviders: providers.filter(p => p.status === ProviderStatus.ACTIVE).length,
      totalProviders: providers.length,
      totalCost: totalCost._sum.estimatedCostUsd || 0,
      monthlyCost: costData._sum.estimatedCostUsd || 0,
      growth: 12,
    };
  }

  async getRecentActivity() {
    return this.prisma.usageLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        provider: true,
      },
    });
  }

  async getDailyUsage(days: number = 7) {
    const dates: string[] = []; // Type declared as string array
    const counts: number[] = []; // Type declared as number array
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await this.prisma.usageLog.count({
        where: {
          createdAt: {
            gte: date,
            lt: nextDate,
          },
        },
      });
      
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      counts.push(count);
    }
    
    return { labels: dates, data: counts };
  }

  async getProviderDistribution() {
    const providers = await this.prisma.provider.findMany({
      include: {
        usageLogs: {
          where: {
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
      },
    });
    
    return {
      labels: providers.map(p => p.displayName),
      data: providers.map(p => p.usageLogs.length),
    };
  }

  async getAllProviders() {
    return this.prisma.provider.findMany({
      include: {
        models: true,
      },
      orderBy: { priority: 'asc' },
    });
  }

  async updateProviderStatus(providerId: string, status: ProviderStatus) {
    return this.prisma.provider.update({
      where: { id: providerId },
      data: { status, updatedAt: new Date() },
    });
  }

  async updateProviderApiKey(
    providerId: string,
    encryptedKey: string,
    iv: string,
    authTag: string,
  ) {
    return this.prisma.provider.update({
      where: { id: providerId },
      data: {
        encryptedKey,
        keyIv: iv,
        keyTag: authTag,
        status: ProviderStatus.ACTIVE,
        updatedAt: new Date(),
      },
    });
  }

  async getAllApiKeys() {
    // Get ALL API keys for all users (admin view)
    const apiKeys = await this.prisma.apiKey.findMany({
      include: { 
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          }
        } 
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`Retrieved ${apiKeys.length} API keys from database`);
    
    // Transform the data for the template
    return apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      status: key.status,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      usageCount: key.usageCount,
      rpmLimit: key.rpmLimit,
      rpdLimit: key.rpdLimit,
      monthlyTokenLimit: key.monthlyTokenLimit ? Number(key.monthlyTokenLimit) : null,
      createdAt: key.createdAt,
      user: {
        email: key.user.email,
        name: key.user.name,
        role: key.user.role,
      }
    }));
  }

  async getUserApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createApiKey(
    userId: string, // This will come from session
    name: string,
    scopes: ApiKeyScope[],
    options?: {
      expiresAt?: Date;
      rpmLimit?: number;
      rpdLimit?: number;
      monthlyTokenLimit?: number;
    }
  ) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const rawKey = `ai-gateway-${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 12);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        keyHash,
        keyPrefix,
        name,
        scopes,
        status: ApiKeyStatus.ACTIVE,
        expiresAt: options?.expiresAt,
        rpmLimit: options?.rpmLimit,
        rpdLimit: options?.rpdLimit,
        monthlyTokenLimit: options?.monthlyTokenLimit ? BigInt(options.monthlyTokenLimit) : null,
      },
    });

    // Create rate limit bucket
    await this.prisma.rateLimitBucket.create({
      data: {
        apiKeyId: apiKey.id,
        minuteCount: 0,
        dayCount: 0,
        minuteResetsAt: new Date(Date.now() + 60000),
        dayResetsAt: new Date(Date.now() + 86400000),
      },
    });

    return { apiKey, rawKey };
  }

  // Add method to get API key stats
  async getApiKeyStats() {
    const [totalKeys, activeKeys, totalCalls, totalCost] = await Promise.all([
      this.prisma.apiKey.count(),
      this.prisma.apiKey.count({ where: { status: ApiKeyStatus.ACTIVE } }),
      this.prisma.usageLog.count(),
      this.prisma.usageLog.aggregate({
        _sum: { estimatedCostUsd: true },
      }),
    ]);

    return {
      totalKeys,
      activeKeys,
      totalCalls,
      totalCost: totalCost._sum.estimatedCostUsd || 0,
    };
  }

  // Add method to get single API key
  async getApiKey(id: string) {
    return this.prisma.apiKey.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  // Add method to update API key
  async updateApiKey(id: string, data: {
    name?: string;
    scopes?: ApiKeyScope[];
    rpmLimit?: number;
    rpdLimit?: number;
    monthlyTokenLimit?: number;
    expiresAt?: Date;
  }) {
    return this.prisma.apiKey.update({
      where: { id },
      data: {
        name: data.name,
        scopes: data.scopes,
        rpmLimit: data.rpmLimit,
        rpdLimit: data.rpdLimit,
        monthlyTokenLimit: data.monthlyTokenLimit ? BigInt(data.monthlyTokenLimit) : null,
        expiresAt: data.expiresAt,
        updatedAt: new Date(),
      },
    });
  }

  async revokeApiKey(apiKeyId: string) {
    return this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        status: ApiKeyStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
  }

  async getUsers() {
    return this.prisma.user.findMany({
      include: {
        apiKeys: true,
        usageLogs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getTopUsers(limit: number = 10) {
    const users = await this.prisma.user.findMany({
      where: { role: 'USER' },
      include: {
        usageLogs: {
          select: {
            totalTokens: true,
            estimatedCostUsd: true,
          }
        }
      }
    });
    
    return users.map(user => ({
      id: user.id,
      email: user.email,
      totalCalls: user.usageLogs.length,
      totalTokens: user.usageLogs.reduce((sum, log) => sum + (log.totalTokens || 0), 0),
      totalCost: user.usageLogs.reduce((sum, log) => sum + log.estimatedCostUsd, 0)
    })).sort((a, b) => b.totalCalls - a.totalCalls).slice(0, limit);
  }
}