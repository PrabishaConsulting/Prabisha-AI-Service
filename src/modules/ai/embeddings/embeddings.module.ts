import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingsController } from './embeddings.controller';
import { ProvidersModule } from '../providers/providers.module';
import { AuthModule } from '../../auth/auth.module';
import { UsageModule } from '../../usage/usage.module';

@Module({
  imports: [ProvidersModule, AuthModule, UsageModule],
  controllers: [EmbeddingsController],
  providers: [EmbeddingsService],
})
export class EmbeddingsModule {}
