// src/modules/documents/documents.controller.ts
import { Controller, Post, Body, UseGuards, Req, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ParseDocumentDto } from './dto/parse-document';

@Controller('documents')
@UseGuards(ApiKeyGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('parse')
  @UseInterceptors(FileInterceptor('file'))
  async parseDocument(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ParseDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('A PDF file is required in the "file" form field');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Document parsing currently supports PDF files only');
    }

    return this.documentsService.parseDocument(
      { file: file.buffer, mimeType: file.mimetype, ...body },
      req.user.id,
      req.user.apiKeyId
    );
  }
}