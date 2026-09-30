import { Injectable } from '@nestjs/common';
import { CreateImageDto } from './dto/create-image.dto';
import { UpdateImageDto } from './dto/update-image.dto';
import { ProviderRouterService } from '../providers/provider-router.service';
import { ImageGenerationRequest, ImageGenerationResponse } from '../providers/provider.interface';
import { UsageService } from '../../usage/usage.service';
import { Modality } from 'src/generated/prisma/enums';

@Injectable()
export class ImageService {
  constructor(
    private readonly providerRouter: ProviderRouterService,
    private readonly usageService: UsageService,
  ) {}

  async create(
    createImageDto: CreateImageDto,
    userId: string,
    apiKeyId: string,
    requestOriginUrl?: string,
    ipAddress?: string,
  ): Promise<ImageGenerationResponse> {
    const { prompt, model, preferredProvider, size, quality, n } = createImageDto;
    const request: ImageGenerationRequest = { prompt, model, size, quality, n };

    const response = await this.providerRouter.routeImageRequest(request, preferredProvider);
    await this.usageService.trackUsage({
      userId,
      apiKeyId,
      endpoint: '/image',
      requestOriginUrl,
      ipAddress,
      modality: Modality.IMAGE,
      providerId: response.providerId,
      providerModelId: response.providerModelId,
      providerName: response.provider,
      modelId: response.model,
      imageCount: response.images.length,
      latencyMs: response.latency,
    });
    return response;
  }

  findAll() {
    return `This action returns all image`;
  }

  findOne(id: number) {
    return `This action returns a #${id} image`;
  }

  update(id: number, updateImageDto: UpdateImageDto) {
    return `This action updates a #${id} image`;
  }

  remove(id: number) {
    return `This action removes a #${id} image`;
  }
}
