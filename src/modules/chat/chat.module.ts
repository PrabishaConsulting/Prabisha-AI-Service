// src/modules/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ProvidersModule } from '../providers/providers.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    CacheModule.register(),
    BullModule.registerQueue({ name: 'usage-tracking' }),
    ProvidersModule,
    AuthModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}