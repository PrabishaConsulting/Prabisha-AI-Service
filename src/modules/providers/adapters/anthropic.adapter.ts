// src/modules/providers/adapters/anthropic.adapter.ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, ChatRequest, ChatResponse } from '../provider.interface';
import { ProviderName, Modality } from 'src/generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminService } from '../../admin/admin.service';

@Injectable()
export class AnthropicProvider implements AIProvider {
  name = ProviderName.ANTHROPIC;

  constructor(
    private prisma: PrismaService,
    private adminService: AdminService,
  ) {}

  private async getClient(): Promise<Anthropic> {
    const provider = await this.prisma.provider.findUnique({
      where: { name: ProviderName.ANTHROPIC },
    });

    if (!provider?.encryptedKey) {
      throw new Error('Anthropic API key is not configured in the Admin Panel.');
    }

    const apiKey = await this.adminService.decryptApiKey(
      provider.encryptedKey,
      provider.keyIv,
      provider.keyTag,
    );

    return new Anthropic({ apiKey });
  }

  supportsModality(modality: Modality): boolean {
    return modality === Modality.TEXT;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const client = await this.getClient();
    const systemMessage = request.messages.find(m => m.role === 'system');
    const userMessages = request.messages.filter(m => m.role !== 'system');

    if (userMessages.length === 0) {
      throw new Error('Anthropic chat requests must contain at least one user or assistant message.');
    }

    const response = await client.messages.create({
      model: request.model ?? 'claude-3-5-sonnet-20241022',
      system: systemMessage?.content,
      messages: userMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0.7,
    });

    const latency = Date.now() - startTime;

    return {
      content: response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join(''),
      model: response.model,
      providerName: this.name,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      latency,
    };
  }
}