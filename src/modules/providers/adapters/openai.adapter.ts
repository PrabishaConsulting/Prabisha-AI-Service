// src/modules/providers/adapters/openai.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Modality } from 'src/generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OpenAIProvider {
  private client: OpenAI;
  private readonly logger = new Logger(OpenAIProvider.name);
  public name = 'OPENAI';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.initializeClient();
  }

  private async initializeClient() {
    const provider = await this.prisma.provider.findUnique({
      where: { name: 'OPENAI' },
    });
    
    const apiKey = provider?.encryptedKey || this.configService.get('OPENAI_API_KEY');
    
    if (apiKey) {
      this.client = new OpenAI({ 
        apiKey: this.decryptKey(apiKey),
      });
      this.logger.log('OpenAI client initialized');
    }
  }

  private decryptKey(encryptedKey: string): string {
    // In production, implement proper decryption
    return encryptedKey;
  }

  supportsModality(modality: Modality): boolean {
    return modality === 'TEXT' || modality === 'EMBEDDING';
  }

  async chat(request: any): Promise<any> {
    const startTime = Date.now();
    
    // Ensure messages have proper format for OpenAI
    const formattedMessages = request.messages.map((msg: any) => ({
      role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
      content: msg.content,
    }));
    
    const response = await this.client.chat.completions.create({
      model: request.model || 'gpt-3.5-turbo',
      messages: formattedMessages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 1000,
      stream: false,
    });

    const latency = Date.now() - startTime;
    const usage = response.usage!;

    return {
      content: response.choices[0].message.content || '',
      model: response.model,
      provider: this.name,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      latency,
    };
  }
}