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

  private static readonly extractionPrompt = `
You are a document extraction assistant. Extract the text content from this PDF.

Return a JSON array where each element represents ONE page:
[
  {
    "page": 1,
    "content": "Full readable text of the page, preserving paragraphs and structure",
    "pageContext": "Optional brief summary if the page contains mostly tables/images"
  }
]

Rules:
- "page" is 1-based.
- "content" must contain ALL readable text on that page, including headings, body text, list items, and table cell values. Do NOT truncate.
- For pages that are mostly images with little text, describe the visual content in "content".
- For tables, convert them to readable prose: "Column A: val1, Column B: val2".
- Preserve paragraph breaks with \\n+\\n.
- Return ONLY the raw JSON array. No markdown fences, no explanation.
`.trim();

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
    const response = await client.models.generateContent({
      model: targetModel,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: request.mimeType, data: request.file.toString('base64') } },
          { text: request.prompt?.trim() || GeminiProvider.extractionPrompt },
        ],
      }],
      config: { temperature: 0.1 },
    });

    const rawText = (response.text || '').replace(/```json|```/gi, '').trim();
    if (!rawText) throw new Error('Gemini returned an empty response');

    const pages = this.parsePages(rawText);
    const chunks = pages.flatMap((page) => this.chunkPage(page, pages.length));
    if (chunks.length === 0) throw new Error('No text could be extracted from this PDF');

    const fullText = pages.map((page) => page.content.trim()).filter(Boolean).join('\n\n');
    return {
      pages,
      chunks,
      fullText,
      metadata: {
        pageCount: pages.length,
        wordCount: this.countWords(fullText),
        extractedAt: new Date().toISOString(),
        fileType: request.mimeType,
        chunkCount: chunks.length,
        extractionMethod: 'gemini',
      },
      model: targetModel,
      providerName: this.name,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
      latency: Date.now() - startTime,
    };
  }

  private parsePages(rawText: string): ExtractedPage[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      throw new Error(`Gemini returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!Array.isArray(parsed)) throw new Error('Gemini did not return a JSON array');

    return parsed.map((page, index) => {
      if (!page || typeof page !== 'object' || typeof (page as ExtractedPage).content !== 'string') {
        throw new Error(`Gemini returned an invalid page at index ${index}`);
      }
      const extractedPage = page as ExtractedPage;
      return {
        page: typeof extractedPage.page === 'number' ? extractedPage.page : index + 1,
        content: extractedPage.content,
        pageContext: typeof extractedPage.pageContext === 'string' ? extractedPage.pageContext : undefined,
      };
    });
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