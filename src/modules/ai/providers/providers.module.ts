// src/modules/providers/providers.module.ts
import { Module } from '@nestjs/common';
import { ProviderRouterService } from './provider-router.service';
import { OpenAIProvider } from './adapters/openai.adapter';
import { AnthropicProvider } from './adapters/anthropic.adapter';
import { GeminiProvider } from './adapters/gemini.adapter';
import { MistralProvider } from './adapters/mistral.adapter';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminModule } from '../../admin/admin.module';

@Module({
  imports: [PrismaModule, AdminModule],
  providers: [
    ProviderRouterService,
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
    MistralProvider,
  ],
  exports: [ProviderRouterService],
})
export class ProvidersModule {}