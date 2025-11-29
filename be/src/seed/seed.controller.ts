import { Controller, Post, Query, Logger } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  private readonly logger = new Logger(SeedController.name);

  constructor(private readonly seedService: SeedService) {}

  @Post('run')
  async runSeed(@Query('clear') clear?: string) {
    this.logger.warn(
      'Seed endpoint called - this should only be used in development!',
    );

    try {
      if (clear === 'true') {
        await this.seedService.clearDatabase();
      }

      const result = await this.seedService.seed();

      return {
        success: true,
        message: 'Seed completed successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error('Seed failed:', error);
      return {
        success: false,
        message: (error as Error).message || 'Seed failed',
      };
    }
  }

  @Post('clear')
  async clear() {
    this.logger.warn('Clear endpoint called - this will delete all data!');

    try {
      await this.seedService.clearDatabase();
      return {
        success: true,
        message: 'Database cleared successfully',
      };
    } catch (error) {
      this.logger.error('Clear failed:', error);
      return {
        success: false,
        message: (error as Error).message || 'Clear failed',
      };
    }
  }
}
