import { Controller, Get, Query, Render, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './modules/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  @Get()
  @Render('home')
  getHome() {
    return { title: 'AI Gateway - Unified API' };
  }
}
