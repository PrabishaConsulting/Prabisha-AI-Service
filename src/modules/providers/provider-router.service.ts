// src/modules/providers/provider-router.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Modality, ProviderName } from 'src/generated/prisma/enums';
import { OpenAIProvider } from './adapters/openai.adapter';
import { AnthropicProvider } from './adapters/anthropic.adapter';
import { GeminiProvider } from './adapters/gemini.adapter';
import { MistralProvider } from './adapters/mistral.adapter';
import {
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  DocumentParseRequest,
  DocumentParseResponse,
} from './provider.interface';

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
    const selectedModel = await this.prisma.providerModel.findFirst({
      where: request.model
        ? { modelId: request.model }
        : {
            isEnabled: true,
            modality: Modality.TEXT,
            provider: {
              isEnabled: true,
              status: 'ACTIVE',
              ...(preferredProvider
                ? { name: preferredProvider as ProviderName }
                : {}),
            },
          },
      include: { provider: true },
      orderBy: request.model
        ? undefined
        : [
            { provider: { priority: 'asc' } },
            { isDefault: 'desc' },
          ],
    });

    if (
      !selectedModel ||
      !selectedModel.isEnabled ||
      selectedModel.modality !== Modality.TEXT ||
      !selectedModel.provider.isEnabled ||
      selectedModel.provider.status !== 'ACTIVE'
    ) {
      throw new Error(`No active text model found${request.model ? `: ${request.model}` : ''}`);
    }

    const provider = this.providers.get(selectedModel.provider.name);
    if (!provider?.supportsModality(Modality.TEXT)) {
      throw new Error(`Provider ${selectedModel.provider.name} does not support text chat`);
    }

    try {
      this.logger.log(`Using ${selectedModel.provider.name} with model ${selectedModel.modelId}`);
      const startTime = Date.now();
      const response = await provider.chat({
        ...request,
        model: selectedModel.modelId,
      });

      return {
        ...response,
        providerName: selectedModel.provider.name,
        providerId: selectedModel.provider.id,
        providerModelId: selectedModel.id,
        latency: Date.now() - startTime,
        fallbackChain: [selectedModel.provider.name],
      };
    } catch (error) {
      this.logger.error(`${selectedModel.provider.name} failed: ${error?.message ?? error}`);
      throw new Error(`Provider ${selectedModel.provider.name} failed: ${error?.message ?? error}`);
    }
  }

  async routeImageRequest(
    request: ImageGenerationRequest,
    preferredProvider?: string,
  ): Promise<ImageGenerationResponse> {
    const candidateModels = await this.prisma.providerModel.findMany({
      where: {
        ...(request.model
          ? { modelId: request.model }
          : { isEnabled: true, modality: Modality.IMAGE }),
        provider: {
          isEnabled: true,
          status: 'ACTIVE',
          ...(preferredProvider
            ? { name: preferredProvider as ProviderName }
            : {}),
        },
      },
      include: { provider: true },
      orderBy: request.model
        ? undefined
        : [{ provider: { priority: 'asc' } }, { isDefault: 'desc' }],
    });

    const selectedModel = candidateModels.find((candidate) => {
      const provider = this.providers.get(candidate.provider.name);
      return provider?.supportsModality(Modality.IMAGE) && provider.generateImage;
    });

    if (
      !selectedModel ||
      !selectedModel.isEnabled ||
      selectedModel.modality !== Modality.IMAGE ||
      !selectedModel.provider.isEnabled ||
      selectedModel.provider.status !== 'ACTIVE'
    ) {
      throw new Error(`No active image model found${request.model ? `: ${request.model}` : ''}`);
    }

    const provider = this.providers.get(selectedModel.provider.name);

    try {
      this.logger.log(`Using ${selectedModel.provider.name} with model ${selectedModel.modelId}`);
      const startTime = Date.now();
      const response = await provider.generateImage({
        ...request,
        model: selectedModel.modelId,
      });
      return {
        ...response,
        providerId: selectedModel.provider.id,
        providerModelId: selectedModel.id,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`${selectedModel.provider.name} image generation failed: ${error?.message ?? error}`);
      throw new Error(
        `Provider ${selectedModel.provider.name} image generation failed: ${error?.message ?? error}`,
      );
    }
  }

  async routeEmbeddingRequest(
    request: EmbeddingRequest,
    preferredProvider?: string,
  ): Promise<EmbeddingResponse> {
    const candidateModels = await this.prisma.providerModel.findMany({
      where: {
        ...(request.model
          ? { modelId: request.model }
          : { isEnabled: true, modality: Modality.EMBEDDING }),
        provider: {
          isEnabled: true,
          status: 'ACTIVE',
          ...(preferredProvider
            ? { name: preferredProvider as ProviderName }
            : {}),
        },
      },
      include: { provider: true },
      orderBy: request.model
        ? undefined
        : [{ provider: { priority: 'asc' } }, { isDefault: 'desc' }],
    });

    const selectedModel = candidateModels.find((candidate) => {
      const provider = this.providers.get(candidate.provider.name);
      return provider?.supportsModality(Modality.EMBEDDING) && provider.generateEmbeddings;
    });

    if (
      !selectedModel ||
      !selectedModel.isEnabled ||
      selectedModel.modality !== Modality.EMBEDDING ||
      !selectedModel.provider.isEnabled ||
      selectedModel.provider.status !== 'ACTIVE'
    ) {
      throw new Error(
        `No active embedding model found${request.model ? `: ${request.model}` : ''}`,
      );
    }

    const provider = this.providers.get(selectedModel.provider.name);

    try {
      this.logger.log(`Using ${selectedModel.provider.name} with model ${selectedModel.modelId}`);
      const startTime = Date.now();
      const response = await provider.generateEmbeddings({
        ...request,
        model: selectedModel.modelId,
      });
      return {
        ...response,
        providerId: selectedModel.provider.id,
        providerModelId: selectedModel.id,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`${selectedModel.provider.name} embedding generation failed: ${error?.message ?? error}`);
      throw new Error(
        `Provider ${selectedModel.provider.name} embedding generation failed: ${error?.message ?? error}`,
      );
    }
  }

  async routeDocumentRequest(
    request: DocumentParseRequest,
    preferredProvider: ProviderName = ProviderName.GEMINI,
  ): Promise<DocumentParseResponse> {
    const selectedModel = await this.prisma.providerModel.findFirst({
      where: {
        ...(request.model ? { modelId: request.model } : { modality: Modality.TEXT }),
        isEnabled: true,
        provider: {
          name: preferredProvider,
          isEnabled: true,
          status: 'ACTIVE',
        },
      },
      include: { provider: true },
      orderBy: request.model ? undefined : [{ isDefault: 'desc' }],
    });

    if (!selectedModel || selectedModel.modality !== Modality.TEXT) {
      throw new Error(`No active Gemini document model found${request.model ? `: ${request.model}` : ''}`);
    }

    const provider = this.providers.get(selectedModel.provider.name);
    if (!provider?.supportsModality(Modality.TEXT) || !provider.parseDocument) {
      throw new Error(`Provider ${selectedModel.provider.name} does not support document parsing`);
    }

    try {
      const response = await provider.parseDocument({ ...request, model: selectedModel.modelId });
      return {
        ...response,
        providerId: selectedModel.provider.id,
        providerModelId: selectedModel.id,
        fallbackChain: [selectedModel.provider.name],
      };
    } catch (error) {
      this.logger.error(`${selectedModel.provider.name} document parsing failed: ${error?.message ?? error}`);
      throw new Error(`Provider ${selectedModel.provider.name} document parsing failed: ${error?.message ?? error}`);
    }
  }
}