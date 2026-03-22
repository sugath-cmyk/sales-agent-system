import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/index.js';
import { QUEUE_NAMES, AgentJob, scheduleRecurringJobs } from './queue.js';

// Import agents
import { leadResearchAgent } from '../agents/lead-research/index.js';
import { leadScoringAgent } from '../agents/lead-scoring/index.js';
import { emailAgent } from '../agents/email/index.js';
import { linkedInAgent } from '../agents/linkedin/index.js';
import { contentAgent } from '../agents/content/index.js';
import { orchestratorAgent } from '../agents/orchestrator/index.js';
import { leaderAgent } from '../agents/leader/index.js';

// Agent interface for task processing
interface TaskProcessor {
  processTask: (task: { taskId: string; payload: Record<string, unknown>; retryCount: number }) => Promise<{ success: boolean; data?: unknown; error?: string }>;
}

// Create Redis connection for workers
// @ts-ignore - ioredis ESM compatibility
const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Worker options with extended timeouts for Claude API calls
const workerOptions = {
  connection,
  concurrency: 3, // Reduced concurrency to avoid rate limits
  lockDuration: 300000, // 5 minutes lock
  stalledInterval: 60000, // Check for stalled jobs every 60s
  lockRenewTime: 30000, // Renew lock every 30s
  limiter: {
    max: 5,
    duration: 1000,
  },
};

// Process job with agent
async function processAgentJob(
  job: Job<AgentJob>,
  agent: TaskProcessor
): Promise<unknown> {
  console.log(`Processing job ${job.id} - ${job.data.taskType}`);

  // Update progress to keep job alive
  await job.updateProgress(10);

  // Set up periodic progress updates to prevent stalling
  const progressInterval = setInterval(async () => {
    try {
      const currentProgress = (job.progress as number) || 10;
      await job.updateProgress(Math.min(currentProgress + 10, 90));
    } catch (e) {
      // Job may have completed, ignore
    }
  }, 15000); // Update every 15 seconds

  try {
    const result = await agent.processTask({
      taskId: job.data.taskId,
      payload: job.data.payload,
      retryCount: job.attemptsMade,
    });

    clearInterval(progressInterval);
    await job.updateProgress(100);

    if (!result.success) {
      throw new Error(result.error || 'Task failed');
    }

    return result.data;
  } catch (error) {
    clearInterval(progressInterval);
    throw error;
  }
}

// Create workers for each queue
const workers: Worker[] = [];

function createWorker(
  queueName: string,
  agent: TaskProcessor
): Worker<AgentJob> {
  const worker = new Worker<AgentJob>(
    queueName,
    async (job) => processAgentJob(job, agent),
    workerOptions
  );

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`Worker error on ${queueName}:`, err);
  });

  workers.push(worker);
  return worker;
}

// Start all workers
async function startWorkers(): Promise<void> {
  console.log('Starting workers...');

  createWorker(QUEUE_NAMES.LEAD_RESEARCH, leadResearchAgent);
  createWorker(QUEUE_NAMES.LEAD_SCORING, leadScoringAgent);
  createWorker(QUEUE_NAMES.EMAIL, emailAgent);
  createWorker(QUEUE_NAMES.LINKEDIN, linkedInAgent);
  createWorker(QUEUE_NAMES.CONTENT, contentAgent);
  createWorker(QUEUE_NAMES.ORCHESTRATOR, orchestratorAgent);
  createWorker(QUEUE_NAMES.LEADER, leaderAgent);

  console.log(`Started ${workers.length} workers (including Chief 👔)`);

  // Schedule recurring jobs
  await scheduleRecurringJobs();
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('Shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  console.log('Workers shut down');
  process.exit(0);
}

// Handle signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start
startWorkers().catch((err) => {
  console.error('Failed to start workers:', err);
  process.exit(1);
});
