import { randomUUID } from 'node:crypto';

import { capabilityRegistry } from '../registry/registry.js';
import { checkPermission } from '../permissions/permissions.js';
import { ExecutionPlan } from '../planner/planner.js';
import { validatePlan, validateStepInput } from '../execution/plan-validator.js';
import { ExecutionCaller } from '../execution/execution-context.js';
import { resolveResultReferences } from '../execution/result-reference.js';
import { runtimeEventBus } from '../events/memory-event-bus.js';

import { Job, JobOutcome } from './job.js';
import { JobEvent, JobEventType } from './job-event.js';
import { JobStatus } from './job-status.js';
import { JobListFilter, jobStore } from './job-store.js';

import { ConsoleExecutionLogger } from '../execution/console-execution-logger.js';
import { ConsoleLogSink } from '../logging/console-log-sink.js';
import { CompositeLogSink } from '../logging/composite-log-sink.js';
import { SQLiteLogSink } from '../logging/sqlite-log-sink.js';

class JobManager {
  async executePlan(
    plan: ExecutionPlan,
    caller?: ExecutionCaller
  ): Promise<Job> {
    if (!plan.steps.length) {
      throw new Error(
        'Execution plan contains no steps'
      );
    }

    const validation = validatePlan(plan.steps);
    if (!validation.valid) {
      throw new Error(
        `Execution plan failed validation: ${validation.errors
          .map((error) => error.message)
          .join('; ')}`
      );
    }

    const goal =
      plan.goal?.trim() ||
      'External execution plan';

    const job = await this.create(
      goal
    );

    job.idempotencyKey = plan.idempotencyKey;
    job.steps = plan.steps.map((step) => ({
      ...step,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }));
    job.updatedAt =
      new Date().toISOString();

    await jobStore.update(job);

    return this.execute(job.id, caller);
  }

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

  async execute(
    id: string,
    caller?: ExecutionCaller
  ): Promise<Job> {
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
          const completedSteps = job.steps.slice(
            0,
            job.steps.indexOf(step)
          );
          const resolvedInput = resolveResultReferences(
            step.input,
            completedSteps
          );
          const inputValidation = validateStepInput(
            step,
            resolvedInput
          );

          if (!inputValidation.valid) {
            throw new Error(
              inputValidation.errors
                .map((validationError) => validationError.message)
                .join('; ')
            );
          }

          const logger = new ConsoleExecutionLogger(
            job.id,
            step.id,
            new CompositeLogSink([
              new ConsoleLogSink(),
              new SQLiteLogSink(),
            ])
          );

          const result = await capability.execute(
            resolvedInput,
            {
              jobId: job.id,
              stepId: step.id,
              logger,
              caller,
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
