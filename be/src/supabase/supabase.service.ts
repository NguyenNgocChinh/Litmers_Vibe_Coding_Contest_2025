import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabaseClient: SupabaseClient;
  private supabaseAdmin: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY'); // Anon key
    const supabaseServiceRole = this.configService.get<string>('SUPABASE_SERVICE_ROLE');

    if (!supabaseUrl || !supabaseKey || !supabaseServiceRole) {
      throw new Error('Supabase credentials not found in environment variables');
    }

    // Client for general usage (if needed, but mostly we use admin on backend)
    this.supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Admin client for backend operations (bypasses RLS if needed, but we should be careful)
    // Note: In our rules, we use service role key on backend.
    this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);
  }

  getClient(): SupabaseClient {
    return this.supabaseClient;
  }

  getAdmin(): SupabaseClient {
    return this.supabaseAdmin;
  }
}
