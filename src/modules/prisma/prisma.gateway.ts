import { WebSocketGateway } from '@nestjs/websockets';
import { PrismaService } from './prisma.service';

@WebSocketGateway()
export class PrismaGateway {
  constructor(private readonly prismaService: PrismaService) {}
}
