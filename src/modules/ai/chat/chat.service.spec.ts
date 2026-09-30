import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { ProviderRouterService } from '../providers/provider-router.service';
import { UsageService } from '../../usage/usage.service';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: ProviderRouterService, useValue: {} },
        { provide: UsageService, useValue: {} },
        { provide: 'CACHE_MANAGER', useValue: {} },
        { provide: 'BullQueue_usage-tracking', useValue: {} },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
