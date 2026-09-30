import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingsController } from './embeddings.controller';
import { EmbeddingsService } from './embeddings.service';
import { ProviderRouterService } from '../providers/provider-router.service';
import { UsageService } from '../../usage/usage.service';

describe('EmbeddingsController', () => {
  let controller: EmbeddingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmbeddingsController],
      providers: [
        EmbeddingsService,
        { provide: ProviderRouterService, useValue: {} },
        { provide: UsageService, useValue: {} },
      ],
    }).compile();

    controller = module.get<EmbeddingsController>(EmbeddingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
