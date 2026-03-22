import { BaseAgent, TaskContext, AgentConfig } from '../../core/agent-base.js';
import { Tool } from '../../core/claude-client.js';
import { query } from '../../db/client.js';
import { scanStore, StoreAnalysis } from './store-scanner.js';
import { detectPlatform, PlatformInfo } from './tech-detector.js';
import { enrichCompany, enrichContact, EnrichmentData } from './enricher.js';

const SYSTEM_PROMPT = `You are a Lead Research Agent specialized in finding and analyzing D2C e-commerce stores.

Your primary goals:
1. Scan stores to detect their platform (Shopify, WooCommerce)
2. Detect if they have existing shopping assistants (Tidio, Intercom, Gorgias, etc.)
3. Analyze the store's product categories and positioning
4. Enrich company and contact information

When given a domain to research:
1. First, scan the store to detect the platform and existing tools
2. If no shopping assistant detected, this is a potential lead
3. Enrich the company data (industry, size, location)
4. Find the founder/decision-maker contact info
5. Save all findings to the database

Always be thorough in your analysis. A good lead is one that:
- Uses Shopify or WooCommerce
- Does NOT have an existing shopping assistant
- Has decent traffic (10K-500K monthly visitors)
- Is in our target regions (US, UK, AU, IN)

Output your analysis as structured data for the scoring agent to process.`;

const TOOLS: Tool[] = [
  {
    name: 'scan_store',
    description: 'Scan an e-commerce store to detect platform and existing tools',
    input_schema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'The domain to scan (e.g., example.com)',
        },
      },
      required: ['domain'],
    },
  },
  {
    name: 'detect_platform',
    description: 'Detect the e-commerce platform (Shopify, WooCommerce, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'The domain to analyze',
        },
      },
      required: ['domain'],
    },
  },
  {
    name: 'enrich_company',
    description: 'Get company information from enrichment APIs',
    input_schema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'The company domain',
        },
      },
      required: ['domain'],
    },
  },
  {
    name: 'enrich_contact',
    description: 'Find contact information for key decision makers',
    input_schema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'The company domain',
        },
        titles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Job titles to search for (e.g., ["CEO", "Founder", "CMO"])',
        },
      },
      required: ['domain'],
    },
  },
  {
    name: 'save_company',
    description: 'Save or update company information in database',
    input_schema: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        name: { type: 'string' },
        industry: { type: 'string' },
        platform: { type: 'string' },
        has_shopping_assistant: { type: 'boolean' },
        detected_assistants: { type: 'array', items: { type: 'string' } },
        region: { type: 'string' },
        monthly_traffic: { type: 'number' },
        tech_stack: { type: 'object' },
      },
      required: ['domain'],
    },
  },
  {
    name: 'save_contact',
    description: 'Save contact information in database',
    input_schema: {
      type: 'object',
      properties: {
        company_domain: { type: 'string' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        title: { type: 'string' },
        linkedin_url: { type: 'string' },
        is_decision_maker: { type: 'boolean' },
      },
      required: ['company_domain', 'email'],
    },
  },
  {
    name: 'create_lead',
    description: 'Create a new lead from a company and contact',
    input_schema: {
      type: 'object',
      properties: {
        company_domain: { type: 'string' },
        contact_email: { type: 'string' },
        source: { type: 'string' },
        source_details: { type: 'object' },
      },
      required: ['company_domain', 'contact_email'],
    },
  },
];

export class LeadResearchAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'lead_research',
      description: 'Researches and qualifies potential D2C brand leads',
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
      case 'scan_store':
        return this.handleScanStore(input.domain as string);

      case 'detect_platform':
        return this.handleDetectPlatform(input.domain as string);

      case 'enrich_company':
        return this.handleEnrichCompany(input.domain as string);

      case 'enrich_contact':
        return this.handleEnrichContact(
          input.domain as string,
          input.titles as string[] | undefined
        );

      case 'save_company':
        return this.handleSaveCompany(input);

      case 'save_contact':
        return this.handleSaveContact(input);

      case 'create_lead':
        return this.handleCreateLead(input, context);

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  private async handleScanStore(domain: string): Promise<string> {
    try {
      const analysis: StoreAnalysis = await scanStore(domain);
      return JSON.stringify(analysis, null, 2);
    } catch (error) {
      return `Error scanning store: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleDetectPlatform(domain: string): Promise<string> {
    try {
      const platformInfo: PlatformInfo = await detectPlatform(domain);
      return JSON.stringify(platformInfo, null, 2);
    } catch (error) {
      return `Error detecting platform: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleEnrichCompany(domain: string): Promise<string> {
    try {
      const enrichment: EnrichmentData = await enrichCompany(domain);
      return JSON.stringify(enrichment, null, 2);
    } catch (error) {
      return `Error enriching company: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleEnrichContact(
    domain: string,
    titles?: string[]
  ): Promise<string> {
    try {
      const contacts = await enrichContact(domain, titles || ['CEO', 'Founder', 'Owner', 'CMO']);
      return JSON.stringify(contacts, null, 2);
    } catch (error) {
      return `Error enriching contact: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleSaveCompany(input: Record<string, unknown>): Promise<string> {
    const result = await query<{ id: string }>(
      `INSERT INTO companies (domain, name, industry, platform, has_shopping_assistant, detected_assistants, region, monthly_traffic, tech_stack, enriched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (domain) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, companies.name),
         industry = COALESCE(EXCLUDED.industry, companies.industry),
         platform = COALESCE(EXCLUDED.platform, companies.platform),
         has_shopping_assistant = EXCLUDED.has_shopping_assistant,
         detected_assistants = EXCLUDED.detected_assistants,
         region = COALESCE(EXCLUDED.region, companies.region),
         monthly_traffic = COALESCE(EXCLUDED.monthly_traffic, companies.monthly_traffic),
         tech_stack = EXCLUDED.tech_stack,
         enriched_at = NOW(),
         updated_at = NOW()
       RETURNING id`,
      [
        input.domain,
        input.name,
        input.industry,
        input.platform,
        input.has_shopping_assistant || false,
        input.detected_assistants || [],
        input.region,
        input.monthly_traffic,
        JSON.stringify(input.tech_stack || {}),
      ]
    );

    return `Company saved with ID: ${result.rows[0].id}`;
  }

  private async handleSaveContact(input: Record<string, unknown>): Promise<string> {
    // First get company ID
    const companyResult = await query<{ id: string }>(
      'SELECT id FROM companies WHERE domain = $1',
      [input.company_domain]
    );

    if (companyResult.rows.length === 0) {
      return 'Error: Company not found. Save company first.';
    }

    const companyId = companyResult.rows[0].id;

    const result = await query<{ id: string }>(
      `INSERT INTO contacts (company_id, first_name, last_name, email, title, linkedin_url, is_decision_maker, enrichment_source, enriched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'lead_research_agent', NOW())
       ON CONFLICT (email) DO UPDATE SET
         first_name = COALESCE(EXCLUDED.first_name, contacts.first_name),
         last_name = COALESCE(EXCLUDED.last_name, contacts.last_name),
         title = COALESCE(EXCLUDED.title, contacts.title),
         linkedin_url = COALESCE(EXCLUDED.linkedin_url, contacts.linkedin_url),
         is_decision_maker = EXCLUDED.is_decision_maker,
         enriched_at = NOW(),
         updated_at = NOW()
       RETURNING id`,
      [
        companyId,
        input.first_name,
        input.last_name,
        input.email,
        input.title,
        input.linkedin_url,
        input.is_decision_maker || false,
      ]
    );

    return `Contact saved with ID: ${result.rows[0].id}`;
  }

  private async handleCreateLead(
    input: Record<string, unknown>,
    context: TaskContext
  ): Promise<string> {
    // Get company and contact IDs
    const companyResult = await query<{ id: string }>(
      'SELECT id FROM companies WHERE domain = $1',
      [input.company_domain]
    );

    const contactResult = await query<{ id: string }>(
      'SELECT id FROM contacts WHERE email = $1',
      [input.contact_email]
    );

    if (companyResult.rows.length === 0 || contactResult.rows.length === 0) {
      return 'Error: Company or contact not found.';
    }

    const result = await query<{ id: string }>(
      `INSERT INTO leads (company_id, contact_id, source, source_details, status)
       VALUES ($1, $2, $3, $4, 'new')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        companyResult.rows[0].id,
        contactResult.rows[0].id,
        input.source || 'lead_research_agent',
        JSON.stringify(input.source_details || {}),
      ]
    );

    if (result.rows.length === 0) {
      return 'Lead already exists for this company/contact combination.';
    }

    // Log event
    await this.logEvent('lead_created', result.rows[0].id, undefined, {
      source: input.source,
      domain: input.company_domain,
    });

    return `Lead created with ID: ${result.rows[0].id}`;
  }

  protected buildPromptFromPayload(payload: Record<string, unknown>): string {
    if (payload.domain) {
      return `Research the following domain and create a lead if it qualifies:
Domain: ${payload.domain}

Tasks:
1. Scan the store for platform and existing shopping assistants
2. If no shopping assistant detected, enrich the company data
3. Find the founder/decision-maker contact
4. Save all data and create a lead if qualified`;
    }

    if (payload.domains && Array.isArray(payload.domains)) {
      return `Research the following domains and create leads for qualifying ones:
Domains: ${(payload.domains as string[]).join(', ')}

For each domain:
1. Scan the store for platform and existing shopping assistants
2. Skip if shopping assistant already exists
3. Enrich company and contact data for qualified domains
4. Create leads for all qualified domains`;
    }

    return JSON.stringify(payload, null, 2);
  }
}

// Export singleton
export const leadResearchAgent = new LeadResearchAgent();
