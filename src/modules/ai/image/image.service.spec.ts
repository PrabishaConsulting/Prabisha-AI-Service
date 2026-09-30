import { Test, TestingModule } from '@nestjs/testing';
import { ImageService } from './image.service';
import { ProviderRouterService } from '../providers/provider-router.service';
import { UsageService } from '../../usage/usage.service';

describe('ImageService', () => {
  let service: ImageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageService,
        { provide: ProviderRouterService, useValue: {} },
        { provide: UsageService, useValue: {} },
      ],
    }).compile();

    service = module.get<ImageService>(ImageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
