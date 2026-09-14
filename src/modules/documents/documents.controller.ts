// src/modules/documents/documents.controller.ts
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ParseDocumentDto } from './dto/parse-document';

@Controller('documents')
@UseGuards(ApiKeyGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('parse')
  async parseDocument(
    @Req() req: any,
    @Body() body: ParseDocumentDto
  ) {
    return this.documentsService.parseDocument(
      body,
      req.user.id,
      req.user.apiKeyId
    );
  }
}