// src/modules/providers/adapters/mistral.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import { Modality } from 'src/generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MistralProvider {
  private readonly logger = new Logger(MistralProvider.name);
  public name = 'MISTRAL';

  constructor(private prisma: PrismaService) {
    this.initializeClient();
  }

  private async initializeClient() {
    this.logger.log('Mistral provider ready');
  }

  supportsModality(modality: Modality): boolean {
    return modality === 'TEXT';
  }

  async chat(request: any): Promise<any> {
    // Implement Mistral API call here
    throw new Error('Mistral provider not fully implemented yet');
  }
}