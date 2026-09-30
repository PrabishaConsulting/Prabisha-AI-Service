import { Module } from '@nestjs/common';
import { ImageService } from './image.service';
import { ImageController } from './image.controller';
import { ProvidersModule } from '../providers/providers.module';
import { AuthModule } from '../../auth/auth.module';
import { UsageModule } from '../../usage/usage.module';

@Module({
  imports: [ProvidersModule, AuthModule, UsageModule],
  controllers: [ImageController],
  providers: [ImageService],
})
export class ImageModule {}
