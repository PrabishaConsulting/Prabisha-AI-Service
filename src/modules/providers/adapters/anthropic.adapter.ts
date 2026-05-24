// src/modules/providers/adapters/anthropic.adapter.ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, ChatRequest, ChatResponse } from '../provider.interface';
import { ProviderName, Modality } from 'src/generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  name = ProviderName.ANTHROPIC;

  constructor(private prisma: PrismaService) {
    this.initializeClient();
  }

  private async initializeClient() {
    const provider = await this.prisma.provider.findUnique({
      where: { name: ProviderName.ANTHROPIC },
    });
    
    if (provider && provider.encryptedKey) {
      const apiKey = this.decryptKey(provider.encryptedKey);
      this.client = new Anthropic({ apiKey });
    }
  }

  private decryptKey(encryptedKey: string): string {
    return encryptedKey; // Implement proper decryption
  }

  supportsModality(modality: Modality): boolean {
    return modality === Modality.TEXT;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    // Convert OpenAI format to Anthropic format
    const systemMessage = request.messages.find(m => m.role === 'system');
    const userMessages = request.messages.filter(m => m.role !== 'system');
    
    const response = await this.client.messages.create({
      model: request.model || 'claude-3-sonnet-20241022',
      system: systemMessage?.content,
      messages: userMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature || 0.7,
    });

    const latency = Date.now() - startTime;

    return {
      content: response.content[0].type === 'text' ? response.content[0].text : '',
      model: response.model,
      provider: this.name,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      latency,
    };
  }
}