// src/modules/providers/adapters/openai.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Modality, ProviderName } from 'src/generated/prisma/enums';
import {
  EmbeddingRequest,
  EmbeddingResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from '../provider.interface';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OpenAIProvider {
  private client: OpenAI;
  private readonly logger = new Logger(OpenAIProvider.name);
  public name = ProviderName.OPENAI;

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
    return modality === Modality.TEXT || modality === Modality.EMBEDDING || modality === Modality.IMAGE;
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.client) {
      throw new Error('OpenAI API client is not initialized.');
    }

    const response = await this.client.images.generate({
      model: request.model || 'dall-e-3',
      prompt: request.prompt,
      size: request.size as '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792' | undefined,
      quality: request.quality as 'standard' | 'hd' | undefined,
      n: request.n || 1,
    });

    return {
      images: (response.data || []).map(image => image.url || `data:image/png;base64,${image.b64_json}`),
      provider: ProviderName.OPENAI,
      model: request.model || 'dall-e-3',
    };
  }

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.client) {
      throw new Error('OpenAI API client is not initialized.');
    }

    const response = await this.client.embeddings.create({
      model: request.model || 'text-embedding-3-small',
      input: request.input,
    });

    return {
      embeddings: response.data.map(item => item.embedding),
      provider: ProviderName.OPENAI,
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
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
      providerName: this.name,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      latency,
    };
  }
}