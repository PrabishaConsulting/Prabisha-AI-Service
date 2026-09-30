import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { CreateEmbeddingDto } from './dto/create-embedding.dto';
import { UpdateEmbeddingDto } from './dto/update-embedding.dto';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';

@Controller('embeddings')
@UseGuards(ApiKeyGuard)
export class EmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) {}

  @Post()
  create(@Body() createEmbeddingDto: CreateEmbeddingDto, @Req() req: any) {
    const requestOriginUrl = req.headers.origin || req.headers.referer || req.headers['x-client-origin'];
    return this.embeddingsService.create(
      createEmbeddingDto,
      req.user.id,
      req.user.apiKeyId,
      requestOriginUrl,
      req.ip || req.socket.remoteAddress,
    );
  }

  @Get()
  findAll() {
    return this.embeddingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.embeddingsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEmbeddingDto: UpdateEmbeddingDto) {
    return this.embeddingsService.update(+id, updateEmbeddingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.embeddingsService.remove(+id);
  }
}
