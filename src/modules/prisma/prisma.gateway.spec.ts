import { Test, TestingModule } from '@nestjs/testing';
import { PrismaGateway } from './prisma.gateway';
import { PrismaService } from './prisma.service';

describe('PrismaGateway', () => {
  let gateway: PrismaGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaGateway, PrismaService],
    }).compile();

    gateway = module.get<PrismaGateway>(PrismaGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
