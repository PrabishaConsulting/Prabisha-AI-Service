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
    const { userId, apiKeyId, endpoint, tokens, cost, providerId, modelId } = job.data;
    
    try {
      // Check if required fields exist
      if (!userId || !apiKeyId) {
        this.logger.warn('Missing required fields for usage tracking');
        return;
      }

      // Find or get provider and model IDs
      let finalProviderId = providerId;
      let finalModelId = modelId;

      if (!finalProviderId) {
        const defaultProvider = await this.prisma.provider.findFirst({
          where: { isEnabled: true },
        });
        if (defaultProvider) {
          finalProviderId = defaultProvider.id;
          
          const defaultModel = await this.prisma.providerModel.findFirst({
            where: { providerId: defaultProvider.id },
          });
          if (defaultModel) {
            finalModelId = defaultModel.id;
          }
        }
      }

      await this.prisma.usageLog.create({
        data: {
          userId: userId,
          apiKeyId: apiKeyId,
          providerId: finalProviderId || '',
          providerModelId: finalModelId || '',
          modality: 'TEXT',
          status: 'SUCCESS',
          endpointPath: endpoint || '/api/chat',
          totalTokens: tokens || 0,
          estimatedCostUsd: cost || 0,
          latencyMs: 0,
          requestId: `job_${job.id}_${Date.now()}`,
          isCached: false,
          fallbackUsed: false,
          fallbackChain: [],
          createdAt: new Date(),
        },
      });
      
      this.logger.log(`Usage tracked for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to track usage: ${error}`);
    }
  }
}