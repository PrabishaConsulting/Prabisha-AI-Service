import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { ImageService } from './image.service';
import { CreateImageDto } from './dto/create-image.dto';
import { UpdateImageDto } from './dto/update-image.dto';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';

@Controller('image')
@UseGuards(ApiKeyGuard)
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  @Post()
  async create(@Body() createImageDto: CreateImageDto, @Req() req: any) {
    const requestOriginUrl = req.headers['x-client-origin'] || req.headers.origin || req.headers.referer;
    return this.imageService.create(
      createImageDto,
      req.user.id,
      req.user.apiKeyId,
      requestOriginUrl,
      req.ip || req.socket.remoteAddress,
    );
  }

  @Get()
  findAll() {
    return this.imageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.imageService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateImageDto: UpdateImageDto) {
    return this.imageService.update(+id, updateImageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.imageService.remove(+id);
  }
}
