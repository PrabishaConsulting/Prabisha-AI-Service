// src/modules/usage/usage.processor.ts
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Processor('usage-tracking')
export class UsageProcessor {
  private readonly logger = new Logger(UsageProcessor.name);

  constructor(private prisma: PrismaService) {}

  @Process('track-usage')
  async handleUsageTracking(job: Job) {
    const {
      userId,
      apiKeyId,
      endpoint,
      promptTokens,
      completionTokens,
      tokens,
      cost,
      latencyMs,
      providerId,
      providerModelId,
      fallbackChain,
      modality,
      imageCount,
      isCached,
      requestOriginUrl,
      ipAddress,
    } = job.data;

    try {
      if (!userId || !apiKeyId) {
        this.logger.warn('Missing required fields for usage tracking');
        return;
      }

      const finalFallbackChain = fallbackChain || [];

      if (!providerId || !providerModelId) {
        throw new Error('Provider and provider model are required for usage logging');
      }

      const providerModel = await this.prisma.providerModel.findUnique({
        where: { id: providerModelId },
      });
      if (!providerModel) throw new Error('Provider model not found for usage logging');

      const inputUnits = promptTokens ?? 0;
      const outputUnits = completionTokens ?? 0;
      const tokenCost = (inputUnits / 1000) * providerModel.inputPricePer1k
        + (outputUnits / 1000) * providerModel.outputPricePer1k;
      const cost = modality === 'IMAGE'
        ? (imageCount ?? 0) * providerModel.outputPricePer1k
        : tokenCost;

      await this.prisma.usageLog.create({
        data: {
          userId,
          apiKeyId,
          providerId,
          providerModelId,
          modality: modality || 'TEXT',
          status: job.data.status || 'SUCCESS',
          endpointPath: endpoint || '/chat',
          requestOriginUrl: requestOriginUrl ?? null,
          ipAddress: ipAddress ?? null,
          promptTokens: promptTokens ?? null,
          completionTokens: completionTokens ?? null,
          totalTokens: tokens ?? 0,
          estimatedCostUsd: cost,
          latencyMs: latencyMs ?? 0,
          requestId: `job_${job.id}_${Date.now()}`,
          isCached: isCached ?? false,
          fallbackUsed: finalFallbackChain.length > 1,
          fallbackChain: finalFallbackChain,
          createdAt: new Date(),
        },
      });

      this.logger.log(`Usage tracked for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to track usage: ${error}`);
    }
  }
}