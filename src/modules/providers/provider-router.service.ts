// src/modules/providers/provider-router.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Modality } from 'src/generated/prisma/enums';
import { OpenAIProvider } from './adapters/openai.adapter';
import { AnthropicProvider } from './adapters/anthropic.adapter';
import { GeminiProvider } from './adapters/gemini.adapter';
import { MistralProvider } from './adapters/mistral.adapter';

export interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;
}

@Injectable()
export class ProviderRouterService {
  private readonly logger = new Logger(ProviderRouterService.name);
  private providers: Map<string, any> = new Map();

  constructor(
    private prisma: PrismaService,
    private openaiProvider: OpenAIProvider,
    private anthropicProvider: AnthropicProvider,
    private geminiProvider: GeminiProvider,
    private mistralProvider: MistralProvider,
  ) {
    this.providers.set('OPENAI', this.openaiProvider);
    this.providers.set('ANTHROPIC', this.anthropicProvider);
    this.providers.set('GEMINI', this.geminiProvider);
    this.providers.set('MISTRAL', this.mistralProvider);
  }

  async routeChatRequest(
    request: ChatRequest,
    preferredProvider?: string,
    userId?: string,
    apiKeyId?: string,
  ): Promise<ChatResponse> {
    // Get all active providers
    const activeProviders = await this.prisma.provider.findMany({
      where: {
        status: 'ACTIVE',
        isEnabled: true,
      },
      orderBy: { priority: 'asc' },
    });

    if (activeProviders.length === 0) {
      throw new Error('No active AI providers available');
    }

    // Sort by priority and optionally put preferred first
    let sortedProviders = [...activeProviders];
    if (preferredProvider) {
      sortedProviders.sort((a, b) => {
        if (a.name === preferredProvider) return -1;
        if (b.name === preferredProvider) return 1;
        return a.priority - b.priority;
      });
    }

    let lastError: Error | null = null;
    const fallbackChain: string[] = [];

    // Try each provider in order
    for (const providerConfig of sortedProviders) {
      try {
        this.logger.log(`Attempting chat with ${providerConfig.name}`);
        fallbackChain.push(providerConfig.name);

        const provider = this.providers.get(providerConfig.name);
        if (!provider) {
          this.logger.warn(`Provider ${providerConfig.name} not registered`);
          continue;
        }

        const startTime = Date.now();
        const response = await provider.chat(request);
        const latency = Date.now() - startTime;

        return {
          ...response,
          latency,
        };
      } catch (error) {
        this.logger.error(`Provider ${providerConfig.name} failed:`, error.message);
        lastError = error;
      }
    }

    // All providers failed
    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }
}