import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ProviderRouterService } from '../providers/provider-router.service';

@Injectable()
export class DocumentsService {
  constructor(
    private providerRouter: ProviderRouterService,
    @InjectQueue('usage-tracking') private usageQueue: Queue,
  ) {}

  async parseDocument(
    data: { file: Buffer; mimeType: string; prompt?: string; model?: string },
    userId: string,
    apiKeyId: string,
  ) {
    if (!data.file?.length || !data.mimeType) {
      throw new BadRequestException('Missing required fields for document parsing');
    }
    if (data.mimeType !== 'application/pdf') {
      throw new BadRequestException('Document parsing currently supports PDF files only');
    }

    try {
      const response = await this.providerRouter.routeDocumentRequest(data);
      await this.usageQueue.add('track-usage', {
        userId,
        apiKeyId,
        endpoint: '/documents/parse',
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        tokens: response.usage.totalTokens,
        latencyMs: response.latency,
        providerId: response.providerId,
        providerModelId: response.providerModelId,
        modality: 'TEXT',
        fallbackChain: response.fallbackChain,
      });

      return { success: true, ...response };
    } catch (error) {
      throw new BadRequestException(
        `AI Parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}