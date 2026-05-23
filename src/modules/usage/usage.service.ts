import { Injectable } from '@nestjs/common';
import { CreateUsageDto } from './dto/create-usage.dto';
import { UpdateUsageDto } from './dto/update-usage.dto';

@Injectable()
export class UsageService {
  create(createUsageDto: CreateUsageDto) {
    return 'This action adds a new usage';
  }

  findAll() {
    return `This action returns all usage`;
  }

  findOne(id: number) {
    return `This action returns a #${id} usage`;
  }

  update(id: number, updateUsageDto: UpdateUsageDto) {
    return `This action updates a #${id} usage`;
  }

  remove(id: number) {
    return `This action removes a #${id} usage`;
  }
}
