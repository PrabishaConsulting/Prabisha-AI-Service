// src/modules/chat/chat.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as CacheManager from 'cache-manager';
import { ProviderRouterService } from '../providers/provider-router.service';
import { ChatRequestDto } from './dto/chat-request';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private providerRouter: ProviderRouterService,
    @Inject('CACHE_MANAGER') private cacheManager: CacheManager.Cache,
    @InjectQueue('usage-tracking') private usageQueue: Queue,
  ) {}

  async processChat(request: ChatRequestDto, userId: string, apiKeyId: string) {
    // Check cache
    const cacheKey = this.generateCacheKey(request);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.log('Returning cached response');
      return cached;
    }

    // Route to appropriate provider
    const response = await this.providerRouter.routeChatRequest(
      {
        messages: request.messages,
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      },
      request.preferredProvider,
      userId,
      apiKeyId,
    );

    // Cache response
    await this.cacheManager.set(cacheKey, response, 3600000); // Cache for 1 hour

    // Queue usage tracking
    await this.usageQueue.add('track-usage', {
      userId,
      apiKeyId,
      endpoint: '/chat',
      tokens: response.usage.totalTokens,
      cost: this.calculateCost(response),
      providerId: response.provider,
      modelId: response.model,
    });

    return response;
  }

  async processChatStream(request: ChatRequestDto, userId: string) {
    // Implement streaming if needed
    this.logger.log('Streaming not yet implemented');
    return { message: 'Streaming endpoint coming soon' };
  }

  private generateCacheKey(request: ChatRequestDto): string {
    return `chat:${JSON.stringify(request.messages)}:${request.model || 'default'}`;
  }

  private calculateCost(response: any): number {
    // Simplified cost calculation
    const rates: Record<string, number> = {
      'gpt-3.5-turbo': 0.002,
      'gpt-4': 0.03,
      'claude-3-sonnet': 0.015,
      'gemini-pro': 0.001,
    };
    
    const rate = rates[response.model] || 0.001;
    return (response.usage.totalTokens / 1000) * rate;
  }
}