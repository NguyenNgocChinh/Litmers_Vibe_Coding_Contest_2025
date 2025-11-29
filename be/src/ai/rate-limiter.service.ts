import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimiterService {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(private configService: ConfigService) {
    // Default: 10 requests per minute per user
    this.maxRequests = 10;
    this.windowMs = 60 * 1000; // 1 minute
  }

  async checkLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const entry = this.limits.get(userId);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      this.limits.set(userId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false; // Rate limit exceeded
    }

    entry.count++;
    return true;
  }

  getRemainingRequests(userId: string): number {
    const entry = this.limits.get(userId);
    if (!entry || Date.now() > entry.resetTime) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.count);
  }

  getResetTime(userId: string): number {
    const entry = this.limits.get(userId);
    if (!entry || Date.now() > entry.resetTime) {
      return Date.now();
    }
    return entry.resetTime;
  }
}
