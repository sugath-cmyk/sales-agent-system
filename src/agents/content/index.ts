import { BaseAgent, TaskContext, AgentConfig } from '../../core/agent-base.js';
import { Tool } from '../../core/claude-client.js';
import { query } from '../../db/client.js';
import { claude } from '../../core/claude-client.js';

const SYSTEM_PROMPT = `You are a Content Marketing Agent specialized in creating content for Shopify merchant outreach.

Your primary goals:
1. Create SEO-optimized blog posts targeting Shopify store owners
2. Generate personalized case studies and proposals
3. Write LinkedIn posts and social content
4. Create email templates for the email agent to use

Content Guidelines:
- Focus on conversion optimization for Shopify stores
- Use data and specific metrics wherever possible
- Write for busy entrepreneurs (scannable, actionable)
- Include clear CTAs
- Avoid fluff and generic advice

Target Keywords (SEO):
- Shopify conversion optimization
- Shopify cart abandonment
- AI shopping assistant for Shopify
- Shopify checkout optimization
- D2C conversion rate
- Shopify store optimization

Content Types You Create:
1. Blog Posts: 1000-1500 words, SEO-optimized
2. Case Studies: Problem → Solution → Results format
3. LinkedIn Posts: 100-300 words, conversational
4. Email Templates: Short, punchy, personalized
5. Proposals: Customized for specific prospects

Always write in a professional but conversational tone. Be specific with data and avoid vague claims.`;

const TOOLS: Tool[] = [
  {
    name: 'generate_blog_post',
    description: 'Generate an SEO-optimized blog post',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Blog post topic/title',
        },
        target_keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'SEO keywords to target',
        },
        word_count: {
          type: 'number',
          description: 'Target word count (default 1200)',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'generate_case_study',
    description: 'Generate a case study based on results',
    input_schema: {
      type: 'object',
      properties: {
        company_type: {
          type: 'string',
          description: 'Type of company (e.g., "fashion D2C brand")',
        },
        problem: {
          type: 'string',
          description: 'The problem they faced',
        },
        solution: {
          type: 'string',
          description: 'How the solution helped',
        },
        results: {
          type: 'object',
          description: 'Metrics/results achieved',
        },
      },
      required: ['company_type', 'problem', 'results'],
    },
  },
  {
    name: 'generate_linkedin_post',
    description: 'Generate a LinkedIn post',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Post topic',
        },
        style: {
          type: 'string',
          description: 'Style: thought_leadership, case_study, tip, story',
        },
        include_cta: {
          type: 'boolean',
          description: 'Include call-to-action',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'generate_email_template',
    description: 'Generate an email template for outreach',
    input_schema: {
      type: 'object',
      properties: {
        template_type: {
          type: 'string',
          description: 'Type: cold_email, follow_up, case_study, proposal',
        },
        target_persona: {
          type: 'string',
          description: 'Target persona (e.g., "Shopify store founder")',
        },
        key_message: {
          type: 'string',
          description: 'Core message to convey',
        },
      },
      required: ['template_type'],
    },
  },
  {
    name: 'generate_proposal',
    description: 'Generate a customized proposal for a prospect',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead to generate proposal for',
        },
        pain_points: {
          type: 'array',
          items: { type: 'string' },
          description: 'Identified pain points',
        },
        proposed_solution: {
          type: 'string',
          description: 'Solution overview',
        },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'save_content',
    description: 'Save generated content to database',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Content type: blog, case_study, linkedin_post, email_template, proposal',
        },
        title: {
          type: 'string',
        },
        content: {
          type: 'string',
        },
        seo_keywords: {
          type: 'array',
          items: { type: 'string' },
        },
        meta_description: {
          type: 'string',
        },
        target_industry: {
          type: 'string',
        },
      },
      required: ['type', 'title', 'content'],
    },
  },
  {
    name: 'get_content_ideas',
    description: 'Get content ideas based on trends and gaps',
    input_schema: {
      type: 'object',
      properties: {
        content_type: {
          type: 'string',
          description: 'Type of content to generate ideas for',
        },
        count: {
          type: 'number',
          description: 'Number of ideas to generate',
        },
      },
    },
  },
  {
    name: 'list_content',
    description: 'List existing content pieces',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Filter by content type',
        },
        status: {
          type: 'string',
          description: 'Filter by status: draft, review, published',
        },
        limit: {
          type: 'number',
        },
      },
    },
  },
];

export class ContentAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'content_agent',
      description: 'Creates marketing content for Shopify merchant outreach',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
    };
    super(config);
  }

  protected async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    context: TaskContext
  ): Promise<string> {
    switch (toolName) {
      case 'generate_blog_post':
        return this.handleGenerateBlogPost(input);

      case 'generate_case_study':
        return this.handleGenerateCaseStudy(input);

      case 'generate_linkedin_post':
        return this.handleGenerateLinkedInPost(input);

      case 'generate_email_template':
        return this.handleGenerateEmailTemplate(input);

      case 'generate_proposal':
        return this.handleGenerateProposal(input);

      case 'save_content':
        return this.handleSaveContent(input);

      case 'get_content_ideas':
        return this.handleGetContentIdeas(input);

      case 'list_content':
        return this.handleListContent(input);

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  private async handleGenerateBlogPost(input: Record<string, unknown>): Promise<string> {
    const topic = input.topic as string;
    const keywords = (input.target_keywords as string[]) || ['Shopify', 'conversion optimization'];
    const wordCount = (input.word_count as number) || 1200;

    const prompt = `Write a comprehensive blog post about: "${topic}"

Target Keywords: ${keywords.join(', ')}
Target Word Count: ${wordCount} words

Requirements:
- SEO-optimized with keywords naturally integrated
- Include a compelling headline with the main keyword
- Write for Shopify store owners and e-commerce entrepreneurs
- Include actionable tips with specific examples
- Add statistics and data points where relevant
- Include a clear CTA at the end
- Format with proper headings (H2, H3)
- Write in a professional but conversational tone

Structure:
1. Hook/Introduction (capture attention with a stat or question)
2. The Problem (why this matters)
3. The Solution (3-5 actionable tips/strategies)
4. Case Study/Example (real-world application)
5. Conclusion with CTA

Output as JSON with fields: title, meta_description, content`;

    const response = await claude.generate(
      'You are a content marketing expert specializing in e-commerce and Shopify.',
      prompt,
      { maxTokens: 4096 }
    );

    return response;
  }

  private async handleGenerateCaseStudy(input: Record<string, unknown>): Promise<string> {
    const companyType = input.company_type as string;
    const problem = input.problem as string || 'High cart abandonment and low conversion rates';
    const solution = input.solution as string || 'AI-powered shopping assistant';
    const results = input.results as Record<string, unknown> || {
      conversion_increase: '62%',
      cart_abandonment_reduction: '28%',
      aov_increase: '22%',
    };

    const prompt = `Create a compelling case study with these details:

Company Type: ${companyType}
Problem: ${problem}
Solution: ${solution}
Results: ${JSON.stringify(results)}

Structure:
1. Executive Summary (2-3 sentences)
2. The Challenge (what problems were they facing)
3. The Solution (how we helped)
4. Implementation (brief overview)
5. Results (with specific metrics)
6. Key Takeaways
7. CTA

Make it scannable with bullet points and bold key metrics.
Keep it under 800 words.

Output as JSON with fields: title, summary, content`;

    const response = await claude.generate(
      'You are a B2B case study writer specializing in e-commerce success stories.',
      prompt,
      { maxTokens: 2048 }
    );

    return response;
  }

  private async handleGenerateLinkedInPost(input: Record<string, unknown>): Promise<string> {
    const topic = input.topic as string;
    const style = (input.style as string) || 'thought_leadership';
    const includeCta = input.include_cta !== false;

    const styleGuides: Record<string, string> = {
      thought_leadership: 'Share an insight or perspective that challenges conventional thinking',
      case_study: 'Tell a brief success story with specific results',
      tip: 'Share one actionable tip that readers can implement today',
      story: 'Share a personal story or observation with a business lesson',
    };

    const prompt = `Write a LinkedIn post about: "${topic}"

Style: ${styleGuides[style] || styleGuides.thought_leadership}
Include CTA: ${includeCta}

Requirements:
- Hook in first line (make them want to read more)
- 150-250 words total
- Use line breaks for readability
- Include emojis sparingly (1-2 max)
- End with engagement question or CTA
- Sound authentic, not corporate
- Focus on Shopify/e-commerce audience

Format the output with proper line breaks as it would appear on LinkedIn.`;

    const response = await claude.generate(
      'You are a LinkedIn content creator with expertise in e-commerce.',
      prompt,
      { maxTokens: 1024 }
    );

    return response;
  }

  private async handleGenerateEmailTemplate(input: Record<string, unknown>): Promise<string> {
    const templateType = input.template_type as string;
    const targetPersona = (input.target_persona as string) || 'Shopify store founder';
    const keyMessage = (input.key_message as string) || 'AI shopping assistant for better conversions';

    const prompt = `Create an email template for ${templateType} targeting ${targetPersona}.

Key Message: ${keyMessage}

Requirements:
- Subject line under 50 characters
- Email body under 150 words
- Use personalization variables: {firstName}, {companyName}, {domain}
- Clear single CTA
- Professional but warm tone
- No salesy language

Output as JSON with fields: subject, body, personalization_variables`;

    const response = await claude.generate(
      'You are a cold email expert specializing in B2B SaaS for e-commerce.',
      prompt,
      { maxTokens: 1024 }
    );

    return response;
  }

  private async handleGenerateProposal(input: Record<string, unknown>): Promise<string> {
    const leadId = input.lead_id as string;
    const painPoints = (input.pain_points as string[]) || [];
    const proposedSolution = (input.proposed_solution as string) || 'AI Shopping Assistant';

    // Get lead data
    const leadResult = await query(
      `SELECT
        c.first_name,
        co.name as company_name, co.domain, co.industry, co.monthly_traffic
       FROM leads l
       JOIN contacts c ON l.contact_id = c.id
       JOIN companies co ON l.company_id = co.id
       WHERE l.id = $1`,
      [leadId]
    );

    if (leadResult.rows.length === 0) {
      return `Lead not found: ${leadId}`;
    }

    const lead = leadResult.rows[0];

    const prompt = `Create a customized proposal for:

Company: ${lead.company_name}
Domain: ${lead.domain}
Industry: ${lead.industry || 'E-commerce'}
Monthly Traffic: ${lead.monthly_traffic || 'Unknown'}
Contact: ${lead.first_name}
Pain Points: ${painPoints.length > 0 ? painPoints.join(', ') : 'Conversion optimization, cart abandonment'}
Proposed Solution: ${proposedSolution}

Proposal Structure:
1. Personalized Opening (reference their business)
2. Understanding Their Challenges
3. Our Solution
4. Expected Results (with realistic projections)
5. How It Works (simple 3-step process)
6. Investment Overview
7. Next Steps

Keep it under 500 words. Make it feel custom, not templated.

Output as JSON with fields: title, content`;

    const response = await claude.generate(
      'You are a sales proposal expert for e-commerce software.',
      prompt,
      { maxTokens: 2048 }
    );

    return response;
  }

  private async handleSaveContent(input: Record<string, unknown>): Promise<string> {
    const result = await query<{ id: string }>(
      `INSERT INTO content_pieces
       (type, title, content, seo_keywords, meta_description, target_industry, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft')
       RETURNING id`,
      [
        input.type,
        input.title,
        input.content,
        input.seo_keywords || [],
        input.meta_description,
        input.target_industry || 'e-commerce',
      ]
    );

    await this.logEvent('content_created', undefined, undefined, {
      content_id: result.rows[0].id,
      type: input.type,
      title: input.title,
    });

    return `Content saved with ID: ${result.rows[0].id}`;
  }

  private async handleGetContentIdeas(input: Record<string, unknown>): Promise<string> {
    const contentType = (input.content_type as string) || 'blog';
    const count = (input.count as number) || 5;

    const prompt = `Generate ${count} content ideas for ${contentType} posts targeting Shopify store owners.

For each idea, provide:
1. Title/Topic
2. Target Keyword
3. One-sentence description
4. Why it's relevant now

Focus on:
- Conversion optimization
- Cart abandonment
- AI/automation for e-commerce
- Customer experience
- Growth strategies

Output as JSON array.`;

    const response = await claude.generate(
      'You are a content strategist for e-commerce marketing.',
      prompt,
      { maxTokens: 1024 }
    );

    return response;
  }

  private async handleListContent(input: Record<string, unknown>): Promise<string> {
    let queryText = `
      SELECT id, type, title, status, created_at, views, engagement_score
      FROM content_pieces
      WHERE 1=1`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.type) {
      queryText += ` AND type = $${paramIndex}`;
      params.push(input.type);
      paramIndex++;
    }

    if (input.status) {
      queryText += ` AND status = $${paramIndex}`;
      params.push(input.status);
      paramIndex++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push((input.limit as number) || 20);

    const result = await query(queryText, params);

    return JSON.stringify(result.rows, null, 2);
  }

  protected buildPromptFromPayload(payload: Record<string, unknown>): string {
    if (payload.action === 'create_blog') {
      return `Create a new blog post:
Topic: ${payload.topic || 'Shopify conversion optimization'}
Keywords: ${(payload.keywords as string[])?.join(', ') || 'Shopify, conversion rate, e-commerce'}

Tasks:
1. Generate the blog post content
2. Save it to the database
3. Return the content ID and summary`;
    }

    if (payload.action === 'create_case_study') {
      return `Create a case study:
Company Type: ${payload.company_type}
Results: ${JSON.stringify(payload.results)}

Tasks:
1. Generate the case study
2. Save it to the database
3. Return the content ID`;
    }

    if (payload.action === 'batch_linkedin_posts') {
      return `Generate a batch of LinkedIn posts:
Count: ${payload.count || 5}

Tasks:
1. Get content ideas for LinkedIn posts
2. Generate each post
3. Save them to the database
4. Return list of created posts`;
    }

    return JSON.stringify(payload, null, 2);
  }
}

// Export singleton
export const contentAgent = new ContentAgent();
