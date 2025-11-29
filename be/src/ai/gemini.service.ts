import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Default to gemini-2.5-pro, can be overridden via GEMINI_MODEL env var
    const modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-pro';
    this.model = this.genAI.getGenerativeModel({ model: modelName });
    this.logger.log(`Initialized Gemini model: ${modelName}`);
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      this.logger.error('Gemini API error:', {
        message: error?.message,
        status: error?.status,
        statusText: error?.statusText,
        cause: error?.cause,
        stack: error?.stack,
      });
      
      // Provide more specific error messages
      if (error?.message?.includes('API_KEY')) {
        throw new InternalServerErrorException('Invalid Gemini API key. Please check your GEMINI_API_KEY configuration.');
      }
      if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
        throw new InternalServerErrorException('Gemini API quota exceeded. Please try again later.');
      }
      if (error?.message?.includes('safety')) {
        throw new InternalServerErrorException('Content was blocked by Gemini safety filters.');
      }
      
      throw new InternalServerErrorException(
        `Failed to generate text with Gemini: ${error?.message || 'Unknown error'}`
      );
    }
  }

  async summarizeIssue(title: string, description?: string): Promise<string> {
    const prompt = `Summarize the following issue in 2-3 sentences:
Title: ${title}
Description: ${description || 'No description provided'}

Provide a concise summary that captures the main problem and context.`;
    
    return this.generateText(prompt);
  }

  async suggestSolution(title: string, description?: string): Promise<string> {
    const prompt = `Given the following issue, suggest potential solutions:
Title: ${title}
Description: ${description || 'No description provided'}

Provide 2-3 actionable solution suggestions.`;
    
    return this.generateText(prompt);
  }

  async autoLabel(title: string, description?: string): Promise<string[]> {
    const prompt = `Given the following issue, suggest appropriate labels (e.g., bug, feature, enhancement, documentation):
Title: ${title}
Description: ${description || 'No description provided'}

Return only a comma-separated list of labels, maximum 3 labels.`;
    
    const result = await this.generateText(prompt);
    return result.split(',').map(label => label.trim()).filter(Boolean).slice(0, 3);
  }

  async detectDuplicates(
    title: string,
    description: string | undefined,
    existingIssues: Array<{ id: string; title: string; description?: string }>,
  ): Promise<Array<{ id: string; title: string; similarity: number }>> {
    if (existingIssues.length === 0) {
      return [];
    }

    // Create a prompt to compare the new issue with existing issues
    const issuesList = existingIssues
      .map((issue, index) => {
        return `Issue ${index + 1}:
ID: ${issue.id}
Title: ${issue.title}
Description: ${issue.description || 'No description'}`;
      })
      .join('\n\n');

    const prompt = `Compare the following NEW issue with the list of EXISTING issues and identify the most similar ones.

NEW ISSUE:
Title: ${title}
Description: ${description || 'No description provided'}

EXISTING ISSUES:
${issuesList}

For each existing issue, rate the similarity from 0 to 100 (where 100 is identical).
Return ONLY a JSON array with this exact format:
[
  {"id": "issue-id-1", "similarity": 85},
  {"id": "issue-id-2", "similarity": 72},
  ...
]

Return maximum 3 issues, sorted by similarity (highest first).
Only include issues with similarity >= 50.
Return only the JSON array, no other text.`;

    try {
      const result = await this.generateText(prompt);
      // Parse JSON from response (might have extra text)
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const similarities = JSON.parse(jsonMatch[0]);
      
      // Validate and filter results
      return similarities
        .filter((item: any) => item.id && item.similarity >= 50)
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, 3)
        .map((item: any) => {
          const issue = existingIssues.find((i) => i.id === item.id);
          return {
            id: item.id,
            title: issue?.title || '',
            similarity: Math.round(item.similarity),
          };
        });
    } catch (error) {
      // If parsing fails, return empty array
      console.error('Failed to parse duplicate detection result:', error);
      return [];
    }
  }

  async summarizeComments(comments: Array<{ content: string; user_name?: string; created_at: string }>): Promise<{ summary: string; keyDecisions: string[] }> {
    if (comments.length < 5) {
      throw new Error('At least 5 comments required for summary');
    }

    const commentsText = comments
      .map((comment, index) => {
        const author = comment.user_name || 'Anonymous';
        const date = new Date(comment.created_at).toLocaleDateString();
        return `Comment ${index + 1} (by ${author} on ${date}):
${comment.content}`;
      })
      .join('\n\n');

    const prompt = `Summarize the following discussion from an issue's comments. Provide:
1. A discussion summary (3-5 sentences) covering the main points and flow of the conversation
2. Key decisions made (if any) - list them as bullet points

COMMENTS:
${commentsText}

Return ONLY a JSON object with this exact format:
{
  "summary": "3-5 sentence summary of the discussion",
  "keyDecisions": ["decision 1", "decision 2", ...]
}

If there are no key decisions, return an empty array for keyDecisions.
Return only the JSON object, no other text.`;

    try {
      const result = await this.generateText(prompt);
      // Parse JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse summary result');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || 'Unable to generate summary',
        keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
      };
    } catch (error) {
      console.error('Failed to parse comment summary result:', error);
      throw new InternalServerErrorException('Failed to generate comment summary');
    }
  }
}
