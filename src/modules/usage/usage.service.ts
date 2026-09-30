import { Injectable, Logger } from '@nestjs/common';
import { CreateUsageDto } from './dto/create-usage.dto';
import { UpdateUsageDto } from './dto/update-usage.dto';
import { Modality, RequestStatus } from 'src/generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trackUsage(event: {
    userId: string;
    apiKeyId: string;
    endpoint: string;
    requestOriginUrl?: string;
    ipAddress?: string;
    modality: Modality;
    providerId?: string;
    providerModelId?: string;
    providerName?: string;
    modelId?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    imageCount?: number;
    latencyMs?: number;
    fallbackChain?: string[];
    status?: RequestStatus;
    isCached?: boolean;
  }) {
    try {
      if (!event.providerId || !event.providerModelId) {
        throw new Error('Provider and provider model are required for usage logging');
      }

      const providerModel = await this.prisma.providerModel.findUnique({
        where: { id: event.providerModelId },
      });
      if (!providerModel) {
        throw new Error(`Provider model ${event.providerModelId} not found`);
      }

      const promptTokens = event.promptTokens ?? 0;
      const completionTokens = event.completionTokens ?? 0;
      const totalTokens = event.totalTokens ?? promptTokens + completionTokens;
      const tokenCost = (promptTokens / 1000) * providerModel.inputPricePer1k
        + (completionTokens / 1000) * providerModel.outputPricePer1k;
      const estimatedCostUsd = event.modality === Modality.IMAGE
        ? (event.imageCount ?? 0) * providerModel.outputPricePer1k
        : tokenCost;

      await this.prisma.usageLog.create({
        data: {
          userId: event.userId,
          apiKeyId: event.apiKeyId,
          providerId: event.providerId,
          providerModelId: event.providerModelId,
          modality: event.modality,
          status: event.status ?? RequestStatus.SUCCESS,
          endpointPath: event.endpoint,
          requestOriginUrl: event.requestOriginUrl ?? null,
          ipAddress: event.ipAddress ?? null,
          promptTokens: event.promptTokens ?? null,
          completionTokens: event.completionTokens ?? null,
          totalTokens,
          estimatedCostUsd,
          latencyMs: event.latencyMs ?? 0,
          requestId: randomUUID(),
          isCached: event.isCached ?? false,
          fallbackUsed: (event.fallbackChain?.length ?? 0) > 1,
          fallbackChain: event.fallbackChain ?? [],
        },
      });
    } catch (error) {
      this.logger.error(`Failed to persist usage tracking: ${error?.message ?? error}`);
    }
  }

  create(createUsageDto: CreateUsageDto) {
    return 'This action adds a new usage';
  }

  findAll() {
    return `This action returns all usage`;
  }

  findOne(id: number) {
    return `This action returns a #${id} usage`;
  }

  update(id: number, updateUsageDto: UpdateUsageDto) {
    return `This action updates a #${id} usage`;
  }

  remove(id: number) {
    return `This action removes a #${id} usage`;
  }
}
