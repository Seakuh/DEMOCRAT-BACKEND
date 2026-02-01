import { Controller, Post, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('trigger')
  async triggerSync() {
    const result = await this.syncService.syncDrucksachen();
    return {
      message: 'Sync completed',
      ...result,
    };
  }
}
