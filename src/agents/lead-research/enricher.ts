import { config } from '../../config/index.js';

export interface EnrichmentData {
  company: {
    name?: string;
    domain: string;
    industry?: string;
    employeeCount?: number;
    estimatedRevenue?: string;
    foundedYear?: number;
    headquarters?: {
      city?: string;
      state?: string;
      country?: string;
    };
    description?: string;
    socialProfiles?: {
      linkedin?: string;
      twitter?: string;
      facebook?: string;
    };
    technologies?: string[];
    monthlyTraffic?: number;
  };
  source: string;
}

export interface ContactData {
  firstName?: string;
  lastName?: string;
  email?: string;
  title?: string;
  linkedinUrl?: string;
  phone?: string;
  isDecisionMaker: boolean;
  source: string;
}

// Enrich company data using available APIs
export async function enrichCompany(domain: string): Promise<EnrichmentData> {
  // Try Apollo first (usually has best data)
  if (config.APOLLO_API_KEY) {
    try {
      const apolloData = await enrichFromApollo(domain);
      if (apolloData) {
        return { company: apolloData, source: 'apollo' };
      }
    } catch (error) {
      console.error('Apollo enrichment failed:', error);
    }
  }

  // Try Clearbit
  if (config.CLEARBIT_API_KEY) {
    try {
      const clearbitData = await enrichFromClearbit(domain);
      if (clearbitData) {
        return { company: clearbitData, source: 'clearbit' };
      }
    } catch (error) {
      console.error('Clearbit enrichment failed:', error);
    }
  }

  // Fallback: Basic domain analysis
  return {
    company: {
      domain,
      name: extractNameFromDomain(domain),
    },
    source: 'domain_analysis',
  };
}

// Find contacts at a company
export async function enrichContact(
  domain: string,
  targetTitles: string[] = ['CEO', 'Founder', 'Owner', 'CMO', 'Marketing Director']
): Promise<ContactData[]> {
  const contacts: ContactData[] = [];

  // Try Apollo
  if (config.APOLLO_API_KEY) {
    try {
      const apolloContacts = await findContactsApollo(domain, targetTitles);
      contacts.push(...apolloContacts);
    } catch (error) {
      console.error('Apollo contact search failed:', error);
    }
  }

  // If no contacts found, return empty with suggestion
  if (contacts.length === 0) {
    console.log(`No contacts found for ${domain} - manual research may be needed`);
  }

  return contacts;
}

// Apollo.io enrichment
async function enrichFromApollo(domain: string): Promise<EnrichmentData['company'] | null> {
  const response = await fetch('https://api.apollo.io/v1/organizations/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': config.APOLLO_API_KEY!,
    },
    body: JSON.stringify({ domain }),
  });

  if (!response.ok) {
    throw new Error(`Apollo API error: ${response.status}`);
  }

  const data = await response.json();
  const org = data.organization;

  if (!org) {
    return null;
  }

  return {
    name: org.name,
    domain: org.primary_domain || domain,
    industry: org.industry,
    employeeCount: org.estimated_num_employees,
    estimatedRevenue: org.annual_revenue_printed,
    foundedYear: org.founded_year,
    headquarters: org.headquarters
      ? {
          city: org.headquarters.city,
          state: org.headquarters.state,
          country: org.headquarters.country,
        }
      : undefined,
    description: org.short_description,
    socialProfiles: {
      linkedin: org.linkedin_url,
      twitter: org.twitter_url,
      facebook: org.facebook_url,
    },
    technologies: org.technologies?.map((t: { name: string }) => t.name) || [],
  };
}

// Apollo contact search
async function findContactsApollo(
  domain: string,
  titles: string[]
): Promise<ContactData[]> {
  const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': config.APOLLO_API_KEY!,
    },
    body: JSON.stringify({
      q_organization_domains: domain,
      person_titles: titles,
      per_page: 10,
    }),
  });

  if (!response.ok) {
    throw new Error(`Apollo API error: ${response.status}`);
  }

  const data = await response.json();
  const people = data.people || [];

  return people.map(
    (person: {
      first_name?: string;
      last_name?: string;
      email?: string;
      title?: string;
      linkedin_url?: string;
      phone_numbers?: Array<{ sanitized_number: string }>;
    }): ContactData => ({
      firstName: person.first_name,
      lastName: person.last_name,
      email: person.email,
      title: person.title,
      linkedinUrl: person.linkedin_url,
      phone: person.phone_numbers?.[0]?.sanitized_number,
      isDecisionMaker: isDecisionMakerTitle(person.title || ''),
      source: 'apollo',
    })
  );
}

// Clearbit enrichment
async function enrichFromClearbit(domain: string): Promise<EnrichmentData['company'] | null> {
  const response = await fetch(
    `https://company.clearbit.com/v2/companies/find?domain=${domain}`,
    {
      headers: {
        Authorization: `Bearer ${config.CLEARBIT_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Clearbit API error: ${response.status}`);
  }

  const company = await response.json();

  return {
    name: company.name,
    domain: company.domain,
    industry: company.category?.industry,
    employeeCount: company.metrics?.employees,
    estimatedRevenue: company.metrics?.estimatedAnnualRevenue,
    foundedYear: company.foundedYear,
    headquarters: company.geo
      ? {
          city: company.geo.city,
          state: company.geo.state,
          country: company.geo.country,
        }
      : undefined,
    description: company.description,
    socialProfiles: {
      linkedin: company.linkedin?.handle
        ? `https://linkedin.com/company/${company.linkedin.handle}`
        : undefined,
      twitter: company.twitter?.handle
        ? `https://twitter.com/${company.twitter.handle}`
        : undefined,
      facebook: company.facebook?.handle
        ? `https://facebook.com/${company.facebook.handle}`
        : undefined,
    },
    technologies: company.tech || [],
  };
}

// Helper: Extract company name from domain
function extractNameFromDomain(domain: string): string {
  const parts = domain.replace(/^www\./, '').split('.');
  const name = parts[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Helper: Check if title indicates decision maker
function isDecisionMakerTitle(title: string): boolean {
  const decisionMakerPatterns = [
    /ceo/i,
    /chief.*officer/i,
    /founder/i,
    /co-founder/i,
    /owner/i,
    /president/i,
    /director/i,
    /head of/i,
    /vp/i,
    /vice president/i,
    /partner/i,
  ];

  return decisionMakerPatterns.some((pattern) => pattern.test(title));
}

// Region detection based on various signals
export function detectRegion(
  company: EnrichmentData['company']
): 'US' | 'UK' | 'AU' | 'IN' | 'OTHER' {
  const country = company.headquarters?.country?.toUpperCase();

  if (!country) {
    // Try to infer from domain TLD
    const tld = company.domain.split('.').pop()?.toLowerCase();
    switch (tld) {
      case 'us':
      case 'com':
        return 'US'; // Assume US for .com
      case 'uk':
      case 'co.uk':
        return 'UK';
      case 'au':
      case 'com.au':
        return 'AU';
      case 'in':
      case 'co.in':
        return 'IN';
      default:
        return 'OTHER';
    }
  }

  switch (country) {
    case 'US':
    case 'USA':
    case 'UNITED STATES':
      return 'US';
    case 'UK':
    case 'GB':
    case 'UNITED KINGDOM':
      return 'UK';
    case 'AU':
    case 'AUSTRALIA':
      return 'AU';
    case 'IN':
    case 'INDIA':
      return 'IN';
    default:
      return 'OTHER';
  }
}
