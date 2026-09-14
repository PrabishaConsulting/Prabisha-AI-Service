// src/modules/providers/adapters/gemini.adapter.ts
import * as dns from 'dns';
import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import {
  AIProvider,
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  DocumentParseRequest,
  DocumentParseResponse,
  ExtractedPage,
  DocumentChunk,
} from '../provider.interface';
import { ProviderName, Modality } from 'src/generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminService } from '../../admin/admin.service'; // 1. Import AdminService

dns.setDefaultResultOrder('ipv4first');

@Injectable()
export class GeminiProvider implements AIProvider {
  name = ProviderName.GEMINI;

  constructor(
    private prisma: PrismaService,
    private adminService: AdminService // 2. Inject AdminService
  ) {}

  // 3. Dynamic client generation fetches the freshest key per request
  private async getClient(): Promise<GoogleGenAI> {
    try {
      const provider = await this.prisma.provider.findUnique({
        where: { name: ProviderName.GEMINI },
      });

      if (!provider || !provider.encryptedKey) {
        throw new Error('Gemini API key is not configured in the Admin Panel.');
      }

      // 4. Properly decrypt the key using the IV and Auth Tag
      const apiKey = await this.adminService.decryptApiKey(
        provider.encryptedKey,
        provider.keyIv,
        provider.keyTag
      );

      return new GoogleGenAI({ apiKey });
    } catch (error) {
      console.error('Error initializing Gemini client:', error);
      throw error;
    }
  }

  supportsModality(modality: Modality): boolean {
    return ([Modality.TEXT, Modality.IMAGE, Modality.EMBEDDING] as Modality[]).includes(modality);
  }

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const client = await this.getClient();
    const targetModel = request.model || 'gemini-embedding-2-preview';
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    const response = await client.models.embedContent({
      model: targetModel,
      contents: inputs.map((input) => ({ parts: [{ text: input }] })),
    });

    const embeddings = (response.embeddings || []).map((embedding) => embedding.values || []);
    if (embeddings.length === 0) {
      throw new Error('Gemini returned no embedding data');
    }

    return {
      embeddings,
      provider: this.name,
      model: targetModel,
      usage: {
        promptTokens: 0,
        totalTokens: 0,
      },
    };
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const client = await this.getClient();
    const targetModel = request.model || 'gemini-3.1-flash-image';
    const response = await client.models.generateContent({
      model: targetModel,
      contents: request.prompt,
      config: {
        responseModalities: ['IMAGE'],
      },
    });

    const images = (response.candidates || []).flatMap((candidate) =>
      (candidate.content?.parts || [])
        .filter((part) => part.inlineData?.data)
        .map((part) => `data:${part.inlineData?.mimeType || 'image/png'};base64,${part.inlineData?.data}`),
    );

    if (images.length === 0) {
      throw new Error('Gemini returned no image data');
    }

    return {
      images,
      provider: this.name,
      model: targetModel,
    };
  }

  async parseDocument(request: DocumentParseRequest): Promise<DocumentParseResponse> {
    const client = await this.getClient();
    const targetModel = request.model || 'gemini-2.5-flash';
    const startTime = Date.now();
    const interaction = await client.interactions.create({
      model: targetModel,
      input: [
        {
          type: 'document',
          data: request.file.toString('base64'),
          mime_type: 'application/pdf',
        },
        {
          type: 'text',
          text: request.prompt?.trim() || 'Extract and return the complete content of this document.',
        },
      ],
    });

    const rawText = interaction.output_text?.trim() || '';
    if (!rawText) throw new Error('Gemini returned an empty response');

    const page: ExtractedPage = {
      page: 1,
      content: rawText,
    };
    const pages = [page];
    const chunks = this.chunkPage(page, 1);
    const fullText = rawText;
    const usage = interaction.usage as {
      total_input_tokens?: number;
      total_output_tokens?: number;
      total_tokens?: number;
    } | undefined;

    return {
      pages,
      chunks,
      fullText,
      metadata: {
        pageCount: 1,
        wordCount: this.countWords(fullText),
        extractedAt: new Date().toISOString(),
        fileType: request.mimeType,
        chunkCount: chunks.length,
        extractionMethod: 'gemini-interactions',
      },
      model: targetModel,
      providerName: this.name,
      usage: {
        promptTokens: usage?.total_input_tokens || 0,
        completionTokens: usage?.total_output_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
      },
      latency: Date.now() - startTime,
    };
  }

  private chunkPage(page: ExtractedPage, totalPages: number): DocumentChunk[] {
    const text = page.content.trim();
    if (!text) return [];

    const chunks: string[] = [];
    for (let offset = 0; offset < text.length; offset += 4000) {
      chunks.push(text.slice(offset, offset + 4000).trim());
    }

    return chunks.filter(Boolean).map((content, chunkIndex) => ({
      ...page,
      page: page.page - 1,
      chunkIndex,
      totalChunksOnPage: chunks.length,
      totalPages,
      content,
    }));
  }

  private countWords(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // 5. Initialize the client here
    const client = await this.getClient();

    const startTime = Date.now();
    const targetModel = request.model || 'gemini-2.5-flash';
    const response = await client.models.generateContent({
      model: targetModel,
      contents: request.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      }))
    });
    const latency = Date.now() - startTime;

    return {
      content: response.text || '',
      model: targetModel,
      providerName: this.name,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
      latency,
    };
  }
}