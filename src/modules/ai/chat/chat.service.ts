// src/modules/chat/chat.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import * as CacheManager from 'cache-manager';
import { ProviderRouterService } from '../providers/provider-router.service';
import { ChatRequestDto } from './dto/chat-request';
import { UsageService } from '../../usage/usage.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private providerRouter: ProviderRouterService,
    @Inject('CACHE_MANAGER') private cacheManager: CacheManager.Cache,
    private usageService: UsageService,
  ) {}

  async processChat(
    request: ChatRequestDto,
    userId: string,
    apiKeyId: string,
    requestOriginUrl?: string,
    ipAddress?: string,
  ) {
    // Check cache
    const cacheKey = this.generateCacheKey(request);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.log('Returning cached response');
      const cachedResponse = cached as any;
      await this.usageService.trackUsage({
        userId,
        apiKeyId,
        endpoint: '/chat',
        requestOriginUrl,
        ipAddress,
        modality: 'TEXT',
        providerId: cachedResponse.providerId,
        providerModelId: cachedResponse.providerModelId,
        providerName: cachedResponse.providerName,
        modelId: cachedResponse.model,
        promptTokens: cachedResponse.usage?.promptTokens,
        completionTokens: cachedResponse.usage?.completionTokens,
        totalTokens: cachedResponse.usage?.totalTokens,
        latencyMs: 0,
        fallbackChain: cachedResponse.fallbackChain,
        isCached: true,
      });
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

    // Usage tracking must not delay the provider response.
    await this.usageService.trackUsage({
      userId,
      apiKeyId,
      endpoint: '/chat',
      requestOriginUrl,
      ipAddress,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      modality: 'TEXT',
      latencyMs: response.latency,
      providerId: response.providerId,
      providerModelId: response.providerModelId,
      providerName: response.providerName,
      modelId: response.model,
      fallbackChain: response.fallbackChain,
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

}