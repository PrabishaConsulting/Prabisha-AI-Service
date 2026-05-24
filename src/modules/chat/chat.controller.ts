// src/modules/chat/chat.controller.ts
import { Controller, Post, Body, UseGuards, Req, Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ChatRequestDto } from './dto/chat-request';

@Controller('api/chat')
@UseGuards(ApiKeyGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async chat(
    @Body() request: ChatRequestDto,
    @Req() req: any,
    @Headers('x-api-key') apiKey: string,
  ) {
    const result = await this.chatService.processChat(
      request,
      req.user.id,
      req.user.apiKeyId,
    );
    
    return {
      success: true,
      data: result,
    };
  }

  @Post('stream')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async chatStream(
    @Body() request: ChatRequestDto,
    @Req() req: any,
  ) {
    return this.chatService.processChatStream(request, req.user.id);
  }
}