import { Queue, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/index.js';

// Create Redis connection
// @ts-ignore - ioredis ESM compatibility
const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Define queue names for each agent
export const QUEUE_NAMES = {
  LEAD_RESEARCH: 'lead-research',
  LEAD_SCORING: 'lead-scoring',
  EMAIL: 'email',
  LINKEDIN: 'linkedin',
  CONTENT: 'content',
  ADS: 'ads',
  ORCHESTRATOR: 'orchestrator',
  LEADER: 'leader',
} as const;

// Create queues for each agent
export const queues = {
  leadResearch: new Queue(QUEUE_NAMES.LEAD_RESEARCH, { connection }),
  leadScoring: new Queue(QUEUE_NAMES.LEAD_SCORING, { connection }),
  email: new Queue(QUEUE_NAMES.EMAIL, { connection }),
  linkedin: new Queue(QUEUE_NAMES.LINKEDIN, { connection }),
  content: new Queue(QUEUE_NAMES.CONTENT, { connection }),
  ads: new Queue(QUEUE_NAMES.ADS, { connection }),
  orchestrator: new Queue(QUEUE_NAMES.ORCHESTRATOR, { connection }),
  leader: new Queue(QUEUE_NAMES.LEADER, { connection }),
};

// Job types
export interface AgentJob {
  taskId: string;
  taskType: string;
  payload: Record<string, unknown>;
  priority: number;
  createdAt: string;
}

// Add job to queue
export async function addJob(
  queueName: keyof typeof queues,
  jobData: AgentJob,
  options?: {
    delay?: number;
    attempts?: number;
    backoff?: { type: 'exponential' | 'fixed'; delay: number };
  }
): Promise<Job<AgentJob>> {
  const queue = queues[queueName];

  return queue.add(jobData.taskType, jobData, {
    priority: 10 - jobData.priority, // BullMQ uses lower = higher priority
    delay: options?.delay,
    attempts: options?.attempts || 3,
    backoff: options?.backoff || { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
}

// Schedule recurring jobs
export async function scheduleRecurringJobs(): Promise<void> {
  // Daily scoring run at 6 AM
  await queues.leadScoring.add(
    'daily_scoring',
    {
      taskId: 'recurring_scoring',
      taskType: 'score_batch',
      payload: { action: 'score_batch', limit: 100 },
      priority: 5,
      createdAt: new Date().toISOString(),
    },
    {
      repeat: { pattern: '0 6 * * *' },
    }
  );

  // Hourly email sending
  await queues.email.add(
    'hourly_emails',
    {
      taskId: 'recurring_emails',
      taskType: 'send_batch',
      payload: { action: 'send_next_batch' },
      priority: 7,
      createdAt: new Date().toISOString(),
    },
    {
      repeat: { pattern: '0 * * * *' },
    }
  );

  // Daily LinkedIn follow-ups at 10 AM
  await queues.linkedin.add(
    'daily_linkedin',
    {
      taskId: 'recurring_linkedin',
      taskType: 'send_followups',
      payload: { action: 'send_followup_dms' },
      priority: 5,
      createdAt: new Date().toISOString(),
    },
    {
      repeat: { pattern: '0 10 * * *' },
    }
  );

  // Daily orchestrator run at 7 AM
  await queues.orchestrator.add(
    'daily_operations',
    {
      taskId: 'recurring_orchestrator',
      taskType: 'daily_run',
      payload: { action: 'daily_run' },
      priority: 8,
      createdAt: new Date().toISOString(),
    },
    {
      repeat: { pattern: '0 7 * * *' },
    }
  );

  // Chief's daily performance review at 6 PM
  await queues.leader.add(
    'daily_review',
    {
      taskId: 'recurring_review',
      taskType: 'daily_review',
      payload: { action: 'daily_review' },
      priority: 9,
      createdAt: new Date().toISOString(),
    },
    {
      repeat: { pattern: '0 18 * * *' }, // 6 PM daily
    }
  );

  // Adman's daily campaign optimization at 9 AM
  await queues.ads.add(
    'daily_optimization',
    {
      taskId: 'recurring_ads_optimization',
      taskType: 'daily_optimization',
      payload: { action: 'daily_optimization' },
      priority: 6,
      createdAt: new Date().toISOString(),
    },
    {
      repeat: { pattern: '0 9 * * *' }, // 9 AM daily
    }
  );

  // Adman's hourly performance check (during business hours)
  await queues.ads.add(
    'hourly_performance',
    {
      taskId: 'recurring_ads_performance',
      taskType: 'check_performance',
      payload: { action: 'check_performance' },
      priority: 4,
      createdAt: new Date().toISOString(),
    },
    {
      repeat: { pattern: '0 9-17 * * 1-5' }, // Every hour 9AM-5PM Mon-Fri
    }
  );

  console.log('Recurring jobs scheduled (including Chief daily review and Adman optimization)');
}

// Get queue stats
export async function getQueueStats(): Promise<
  Record<string, { waiting: number; active: number; completed: number; failed: number }>
> {
  const stats: Record<
    string,
    { waiting: number; active: number; completed: number; failed: number }
  > = {};

  for (const [name, queue] of Object.entries(queues)) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    stats[name] = { waiting, active, completed, failed };
  }

  return stats;
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  await Promise.all(Object.values(queues).map((q) => q.close()));
  await connection.quit();
}
