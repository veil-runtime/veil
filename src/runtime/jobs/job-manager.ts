import { randomUUID } from 'node:crypto';

import { capabilityRegistry } from '../registry/registry.js';
import { checkPermission } from '../permissions/permissions.js';
import { plannerRegistry } from '../planner/planner-registry.js';
import { validatePlan } from '../execution/plan-validator.js';
import { runtimeEventBus } from '../events/memory-event-bus.js';

import { Job, JobOutcome } from './job.js';
import { JobEvent, JobEventType } from './job-event.js';
import { JobStatus } from './job-status.js';
import { JobListFilter, jobStore } from './job-store.js';
import { jobMemory } from './job-memory.js';

import { ConsoleExecutionLogger } from '../execution/console-execution-logger.js';
import { ConsoleLogSink } from '../logging/console-log-sink.js';
import { CompositeLogSink } from '../logging/composite-log-sink.js';
import { SQLiteLogSink } from '../logging/sqlite-log-sink.js';

class JobManager {
  async create(
    goal: string,
    planner?: string
  ): Promise<Job>{
    if (!goal?.trim()) {
      throw new Error('Job goal is required');
    }

    const now = new Date().toISOString();

    const job: Job = {
      id: randomUUID(),
      goal: goal.trim(),
      planner,
      status: 'created',
      createdAt: now,
      updatedAt: now,
      steps: [],
      events: [],
    };

    this.addEvent(job, 'job.created', {
      goal: job.goal,
    });

    await jobStore.create(job);

    return job;
  }

  async get(id: string): Promise<Job | undefined> {
    return jobStore.get(id);
  }

  async list(
    filter?: JobListFilter
  ): Promise<Job[]> {
    return jobStore.list(filter);
  }

  async setStatus(
    id: string,
    status: JobStatus
  ): Promise<Job> {
    const job = await jobStore.get(id);

    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    job.status = status;
    job.updatedAt = new Date().toISOString();

    await jobStore.update(job);

    return job;
  }

  async run(
    goal: string,
    planner?: string
  ): Promise<Job> {
    const created = await this.create(goal, planner);

    await this.plan(created.id);

    return this.execute(created.id);
  }

  async plan(id: string): Promise<Job> {
    const job = await jobStore.get(id);

    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    job.status = 'planning';
    job.updatedAt = new Date().toISOString();

    this.addEvent(job, 'planning.started');

    const planner = job.planner
      ? plannerRegistry.get(job.planner)
      : plannerRegistry.getDefault();

    if (!planner) {
      throw new Error(
        `Planner not found: ${job.planner}`
      );
    }

    const context = await jobMemory.getPlannerContext(
      job.goal
    );

    const plan = await planner.plan(
      job.goal,
      context
    );

    const validation = validatePlan(
      plan.steps
    );

    if (!validation.valid) {
      this.addEvent(job, 'planning.completed', {
        planner: planner.name,
        stepCount: plan.steps.length,
        valid: false,
        validationErrors: validation.errors,
      });

      throw new Error(
        `Generated plan failed validation: ${validation.errors
          .map((error) => error.message)
          .join('; ')}`
      );
    }

    job.steps = plan.steps;

    job.status = 'created';
    job.updatedAt = new Date().toISOString();

    this.addEvent(job, 'planning.completed', {
      planner: planner.name,
      stepCount: job.steps.length,
      valid: true,
      memoryJobs:
        context.previousJobs?.length ?? 0,
    });

    await jobStore.update(job);

    return job;
  }

  async execute(id: string): Promise<Job> {
    const job = await jobStore.get(id);

    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    if (job.steps.length === 0) {
      throw new Error('Job has no planned steps');
    }

    job.status = 'executing';
    job.startedAt = new Date().toISOString();
    job.updatedAt = job.startedAt;

    this.addEvent(job, 'execution.started');

    try {
      for (const step of job.steps) {
        const capability = capabilityRegistry.get(step.capability);

        if (!capability) {
          throw new Error(
            `Capability not found: ${step.capability}`
          );
        }

        const permission = checkPermission(capability.risk);

        if (!permission.allowed) {
          throw new Error(
            permission.reason ??
              `Capability not permitted: ${step.capability}`
          );
        }

        step.status = 'running';
        step.startedAt = new Date().toISOString();

        this.addEvent(job, 'capability.started', {
          stepId: step.id,
          capability: step.capability,
        });

        try {
          const logger = new ConsoleExecutionLogger(
            job.id,
            step.id,
            new CompositeLogSink([
              new ConsoleLogSink(),
              new SQLiteLogSink(),
            ])
          );

          const result = await capability.execute(
            step.input,
            {
              jobId: job.id,
              stepId: step.id,
              logger,
            }
          );

          step.result = result;
          step.status = 'completed';
          step.completedAt = new Date().toISOString();

          this.addEvent(job, 'capability.completed', {
            stepId: step.id,
            capability: step.capability,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown capability execution error';

          step.status = 'failed';
          step.error = message;
          step.completedAt = new Date().toISOString();

          this.addEvent(job, 'capability.failed', {
            stepId: step.id,
            capability: step.capability,
            error: message,
          });

          throw error;
        }
      }

      job.status = 'completed';
      job.outcome = 'success';
      job.completedAt = new Date().toISOString();
      job.updatedAt = job.completedAt;

      job.result =
        job.steps.length === 1
          ? job.steps[0].result
          : job.steps.map((step) => step.result);

      this.addEvent(job, 'job.completed', {
        stepCount: job.steps.length,
      });

      await jobStore.update(job);

      return job;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown job execution error';

      job.status = 'failed';
      job.outcome = 'failed';
      job.error = message;
      job.completedAt = new Date().toISOString();
      job.updatedAt = job.completedAt;

      this.addEvent(job, 'job.failed', {
        error: message,
      });

      await jobStore.update(job);

      return job;
    }
  }

  async review(
    id: string,
    outcome: JobOutcome,
    notes?: string
  ): Promise<Job> {
    const job = await jobStore.get(id);

    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    job.outcome = outcome;
    job.updatedAt = new Date().toISOString();

    this.addEvent(job, 'job.reviewed', {
      outcome,
      notes,
    });

    await jobStore.update(job);

    return job;
  }

  private addEvent(
    job: Job,
    type: JobEventType,
    data?: Record<string, unknown>
  ): JobEvent {
    const event: JobEvent = {
      id: randomUUID(),
      jobId: job.id,
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    job.events.push(event);

    void runtimeEventBus.publish({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      jobId: event.jobId,
      stepId:
        typeof event.data?.stepId === 'string'
          ? event.data.stepId
          : undefined,
      data: event.data,
    });

    return event;
  }
}

export const jobManager = new JobManager();