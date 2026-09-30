import { Injectable } from '@nestjs/common';
import { CreateEmbeddingDto } from './dto/create-embedding.dto';
import { UpdateEmbeddingDto } from './dto/update-embedding.dto';
import { ProviderRouterService } from '../providers/provider-router.service';
import { EmbeddingRequest, EmbeddingResponse } from '../providers/provider.interface';
import { UsageService } from '../../usage/usage.service';
import { Modality } from 'src/generated/prisma/enums';

@Injectable()
export class EmbeddingsService {
  constructor(
    private readonly providerRouter: ProviderRouterService,
    private readonly usageService: UsageService,
  ) {}

  async create(
    createEmbeddingDto: CreateEmbeddingDto,
    userId: string,
    apiKeyId: string,
    requestOriginUrl?: string,
    ipAddress?: string,
  ): Promise<EmbeddingResponse> {
    const { input, model, preferredProvider } = createEmbeddingDto;
    const request: EmbeddingRequest = { input, model };

    const response = await this.providerRouter.routeEmbeddingRequest(request, preferredProvider);
    await this.usageService.trackUsage({
      userId,
      apiKeyId,
      endpoint: '/embeddings',
      requestOriginUrl,
      ipAddress,
      modality: Modality.EMBEDDING,
      providerId: response.providerId,
      providerModelId: response.providerModelId,
      providerName: response.provider,
      modelId: response.model,
      promptTokens: response.usage.promptTokens,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latency,
    });
    return response;
  }

  findAll() {
    return `This action returns all embeddings`;
  }

  findOne(id: number) {
    return `This action returns a #${id} embedding`;
  }

  update(id: number, updateEmbeddingDto: UpdateEmbeddingDto) {
    return `This action updates a #${id} embedding`;
  }

  remove(id: number) {
    return `This action removes a #${id} embedding`;
  }
}
