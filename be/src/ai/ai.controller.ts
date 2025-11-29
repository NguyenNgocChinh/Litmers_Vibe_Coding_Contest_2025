import { Controller, Post, Body, UseGuards, NotFoundException, ForbiddenException as NestForbiddenException } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { RateLimiterService } from './rate-limiter.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly rateLimiterService: RateLimiterService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post('summarize')
  async summarizeIssue(@CurrentUser() user: any, @Body() body: { issue_id: string; title: string; description?: string }) {
    // Validate description length
    if (!body.description || body.description.length <= 10) {
      throw new ForbiddenException('Description must be more than 10 characters to generate summary');
    }

    // Check rate limit
    const allowed = await this.rateLimiterService.checkLimit(user.id);
    if (!allowed) {
      throw new ForbiddenException('Rate limit exceeded. Please try again later.');
    }

    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access to issue if issue_id provided
    if (body.issue_id) {
      const { data: issue } = await supabaseAdmin
        .from('issues')
        .select('*, project:projects(team_id)')
        .eq('id', body.issue_id)
        .is('deleted_at', null)
        .single();

      if (!issue) throw new NotFoundException('Issue not found');

      const { data: member } = await supabaseAdmin
        .from('team_members')
        .select('role')
        .eq('team_id', issue.project.team_id)
        .eq('user_id', user.id)
        .single();

      if (!member) throw new NestForbiddenException('Access denied');

      // Check cache
      const descriptionHash = this.hashDescription(body.description);
      const { data: cached } = await supabaseAdmin
        .from('ai_issue_cache')
        .select('content')
        .eq('issue_id', body.issue_id)
        .eq('cache_type', 'summary')
        .eq('description_hash', descriptionHash)
        .single();

      if (cached) {
        return { summary: cached.content, cached: true };
      }
    }

    // Generate summary
    const summary = await this.geminiService.summarizeIssue(body.title, body.description);

    // Save to cache if issue_id provided
    if (body.issue_id) {
      const descriptionHash = this.hashDescription(body.description);
      await supabaseAdmin
        .from('ai_issue_cache')
        .upsert({
          issue_id: body.issue_id,
          cache_type: 'summary',
          content: summary,
          description_hash: descriptionHash,
          updated_at: new Date(),
        }, {
          onConflict: 'issue_id,cache_type',
        });
    }

    return { summary, cached: false };
  }

  @Post('suggest')
  async suggestSolution(@CurrentUser() user: any, @Body() body: { issue_id: string; title: string; description?: string }) {
    // Validate description length
    if (!body.description || body.description.length <= 10) {
      throw new ForbiddenException('Description must be more than 10 characters to generate suggestions');
    }

    // Check rate limit
    const allowed = await this.rateLimiterService.checkLimit(user.id);
    if (!allowed) {
      throw new ForbiddenException('Rate limit exceeded. Please try again later.');
    }

    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access to issue if issue_id provided
    if (body.issue_id) {
      const { data: issue } = await supabaseAdmin
        .from('issues')
        .select('*, project:projects(team_id)')
        .eq('id', body.issue_id)
        .is('deleted_at', null)
        .single();

      if (!issue) throw new NotFoundException('Issue not found');

      const { data: member } = await supabaseAdmin
        .from('team_members')
        .select('role')
        .eq('team_id', issue.project.team_id)
        .eq('user_id', user.id)
        .single();

      if (!member) throw new NestForbiddenException('Access denied');

      // Check cache
      const descriptionHash = this.hashDescription(body.description);
      const { data: cached } = await supabaseAdmin
        .from('ai_issue_cache')
        .select('content')
        .eq('issue_id', body.issue_id)
        .eq('cache_type', 'suggestion')
        .eq('description_hash', descriptionHash)
        .single();

      if (cached) {
        return { suggestions: cached.content, cached: true };
      }
    }

    // Generate suggestions
    const suggestions = await this.geminiService.suggestSolution(body.title, body.description);

    // Save to cache if issue_id provided
    if (body.issue_id) {
      const descriptionHash = this.hashDescription(body.description);
      await supabaseAdmin
        .from('ai_issue_cache')
        .upsert({
          issue_id: body.issue_id,
          cache_type: 'suggestion',
          content: suggestions,
          description_hash: descriptionHash,
          updated_at: new Date(),
        }, {
          onConflict: 'issue_id,cache_type',
        });
    }

    return { suggestions, cached: false };
  }

  @Post('label')
  async autoLabel(@CurrentUser() user: any, @Body() body: { title: string; description?: string }) {
    // Check rate limit
    const allowed = await this.rateLimiterService.checkLimit(user.id);
    if (!allowed) {
      throw new ForbiddenException('Rate limit exceeded. Please try again later.');
    }

    const labels = await this.geminiService.autoLabel(body.title, body.description);
    return { labels };
  }

  @Post('duplicate')
  async detectDuplicates(
    @CurrentUser() user: any,
    @Body() body: { title: string; description?: string; project_id: string },
  ) {
    // Check rate limit
    const allowed = await this.rateLimiterService.checkLimit(user.id);
    if (!allowed) {
      throw new ForbiddenException('Rate limit exceeded. Please try again later.');
    }

    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access to project
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('team_id')
      .eq('id', body.project_id)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', user.id)
      .single();

    if (!member) throw new NestForbiddenException('Access denied');

    // Get all existing issues in this project
    const { data: issues, error } = await supabaseAdmin
      .from('issues')
      .select('id, title, description')
      .eq('project_id', body.project_id)
      .is('deleted_at', null);

    if (error) {
      throw new ForbiddenException('Failed to fetch issues');
    }

    if (!issues || issues.length === 0) {
      return { duplicates: [] };
    }

    // Detect duplicates using AI
    const duplicates = await this.geminiService.detectDuplicates(
      body.title,
      body.description,
      issues,
    );

    return { duplicates };
  }

  @Post('comment-summary')
  async summarizeComments(
    @CurrentUser() user: any,
    @Body() body: { issue_id: string },
  ) {
    // Check rate limit
    const allowed = await this.rateLimiterService.checkLimit(user.id);
    if (!allowed) {
      throw new ForbiddenException('Rate limit exceeded. Please try again later.');
    }

    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access to issue
    const { data: issue } = await supabaseAdmin
      .from('issues')
      .select('*, project:projects(team_id)')
      .eq('id', body.issue_id)
      .is('deleted_at', null)
      .single();

    if (!issue) throw new NotFoundException('Issue not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', issue.project.team_id)
      .eq('user_id', user.id)
      .single();

    if (!member) throw new NestForbiddenException('Access denied');

    // Get comments count
    const { count: commentCount, error: countError } = await supabaseAdmin
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('issue_id', body.issue_id)
      .is('deleted_at', null);

    if (countError) {
      throw new ForbiddenException('Failed to fetch comments');
    }

    if (!commentCount || commentCount < 5) {
      throw new ForbiddenException('At least 5 comments required for summary');
    }

    // Check cache
    const { data: cachedSummary } = await supabaseAdmin
      .from('comment_summaries')
      .select('*')
      .eq('issue_id', body.issue_id)
      .single();

    // Check if cache is valid (comment count matches)
    if (cachedSummary && cachedSummary.comment_count === commentCount) {
      return {
        summary: cachedSummary.summary,
        key_decisions: cachedSummary.key_decisions || [],
        cached: true,
      };
    }

    // Get all comments
    const { data: comments, error: commentsError } = await supabaseAdmin
      .from('comments')
      .select(`
        content,
        created_at,
        user:users!user_id(name)
      `)
      .eq('issue_id', body.issue_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (commentsError) {
      throw new ForbiddenException('Failed to fetch comments');
    }

    // Transform comments for AI
    const commentsForAI = (comments || []).map((comment: any) => ({
      content: comment.content,
      user_name: comment.user?.name,
      created_at: comment.created_at,
    }));

    // Generate summary
    const result = await this.geminiService.summarizeComments(commentsForAI);

    // Save to cache
    if (cachedSummary) {
      // Update existing cache
      await supabaseAdmin
        .from('comment_summaries')
        .update({
          summary: result.summary,
          key_decisions: result.keyDecisions,
          comment_count: commentCount,
          updated_at: new Date(),
        })
        .eq('issue_id', body.issue_id);
    } else {
      // Create new cache
      await supabaseAdmin
        .from('comment_summaries')
        .insert({
          issue_id: body.issue_id,
          summary: result.summary,
          key_decisions: result.keyDecisions,
          comment_count: commentCount,
        });
    }

    return {
      summary: result.summary,
      key_decisions: result.keyDecisions,
      cached: false,
    };
  }

  private hashDescription(description: string): string {
    return crypto.createHash('sha256').update(description || '').digest('hex');
  }
}
