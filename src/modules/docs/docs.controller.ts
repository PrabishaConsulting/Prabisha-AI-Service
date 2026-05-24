// src/modules/docs/docs.controller.ts
import { Controller, Get, Render } from '@nestjs/common';

@Controller('docs')
export class DocsController {
  
  @Get()
  @Render('docs/index')
  async getDocs() {
    return {
      title: 'AI Gateway API Documentation',
      layout: 'layouts/docs', // Use a public layout without auth
    };
  }

  @Get('authentication')
  @Render('docs/auth')
  async getAuthentication() {
    return {
      title: 'Authentication - API Docs',
      layout: 'layouts/docs',
    };
  }

  @Get('chat')
  @Render('docs/chat')
  async getChat() {
    return {
      title: 'Chat API - Documentation',
      layout: 'layouts/docs',
    };
  }

  @Get('image')
  @Render('docs/image')
  async getImage() {
    return {
      title: 'Image Generation API - Documentation',
      layout: 'layouts/docs',
    };
  }

  @Get('embeddings')
  @Render('docs/embeddings')
  async getEmbeddings() {
    return {
      title: 'Embeddings API - Documentation',
      layout: 'layouts/docs',
    };
  }

  @Get('rate-limits')
  @Render('docs/rate-limits')
  async getRateLimits() {
    return {
      title: 'Rate Limits - API Documentation',
      layout: 'layouts/docs',
    };
  }
}