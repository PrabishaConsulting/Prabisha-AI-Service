import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';

@Module({
	imports: [BullModule.registerQueue({ name: 'usage-tracking' }), AdminModule, AuthModule, ProvidersModule],
	controllers: [DocumentsController],
	providers: [DocumentsService],
})
export class DocumentsModule {}
