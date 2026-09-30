import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingsService } from './embeddings.service';
import { ProviderRouterService } from '../providers/provider-router.service';
import { UsageService } from '../../usage/usage.service';

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingsService,
        { provide: ProviderRouterService, useValue: {} },
        { provide: UsageService, useValue: {} },
      ],
    }).compile();

    service = module.get<EmbeddingsService>(EmbeddingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
