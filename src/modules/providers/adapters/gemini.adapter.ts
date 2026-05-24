// src/modules/providers/adapters/gemini.adapter.ts
import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { AIProvider, ChatRequest, ChatResponse, EmbeddingRequest, EmbeddingResponse } from '../provider.interface';
import { ProviderName, Modality } from 'src/generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;
  name = ProviderName.GEMINI;

  constructor(private prisma: PrismaService) {
    this.initializeClient();
  }

  private async initializeClient() {
    const provider = await this.prisma.provider.findUnique({
      where: { name: ProviderName.GEMINI },
    });
    
    if (provider && provider.encryptedKey) {
      const apiKey = this.decryptKey(provider.encryptedKey);
      // The new @google/genai SDK expects an options object
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  private decryptKey(encryptedKey: string): string {
    return encryptedKey;
  }

  supportsModality(modality: Modality): boolean {
    return ([Modality.TEXT, Modality.EMBEDDING] as Modality[]).includes(modality);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error('Gemini API client is not initialized.');
    }

    const startTime = Date.now();
    const targetModel = request.model || 'gemini-2.5-flash';

    // The new SDK structures chat/content generation via the models namespace
    const response = await this.client.models.generateContent({
      model: targetModel,
      // For a stateless chat request passing historical arrays, maps contents to standard array entries
      contents: request.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      }))
    });
    
    const latency = Date.now() - startTime;

    return {
      content: response.text || '',
      model: targetModel,
      provider: this.name,
      // Extract real token information directly from the modern usageMetadata object
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
      latency,
    };
  }
}