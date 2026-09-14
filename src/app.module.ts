// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import { SentryModule } from '@sentry/nestjs/setup';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { UsageModule } from './modules/usage/usage.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { DocsModule } from './modules/docs/docs.module';
import { ImageModule } from './modules/image/image.module';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60'),
        limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
      },
    ]),
    CacheModule.register({
      isGlobal: true,
      ttl: 3600000, // 1 hour
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        username: process.env.REDIS_USERNAME || undefined,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
      },
    }),
    PrismaModule,
    AdminModule,
    AuthModule,
    DocsModule,
    ImageModule,
    EmbeddingsModule,
    DocumentsModule,
    ChatModule,
    ProvidersModule,
    UsageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}