import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { RateLimiterService } from './rate-limiter.service';
import { AiController } from './ai.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [AiController],
  providers: [GeminiService, RateLimiterService],
  exports: [GeminiService, RateLimiterService],
})
export class AiModule {}
