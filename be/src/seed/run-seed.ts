import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('SeedScript');

  try {
    logger.log('Initializing NestJS application...');
    const app = await NestFactory.createApplicationContext(AppModule);

    const seedService = app.get(SeedService);

    // Parse command line arguments
    const args = process.argv.slice(2);
    const shouldClear = args.includes('--clear') || args.includes('-c');

    if (shouldClear) {
      logger.warn('Clearing database...');
      await seedService.clearDatabase();
      logger.log('Database cleared successfully');
    }

    logger.log('Starting seed process...');
    const result = await seedService.seed();

    logger.log('✅ Seed completed successfully!');
    logger.log(`   - Users: ${result.users}`);
    logger.log(`   - Teams: ${result.teams}`);
    logger.log(`   - Projects: ${result.projects}`);
    logger.log(`   - Issues: ${result.issues}`);

    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

bootstrap();
