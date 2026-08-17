import {
  createCapability,
} from '@veil-runtime/core';

export interface GreetInput {
  name: string;
}

export interface GreetResult {
  message: string;
}

export interface CreateNoteInput {
  title: string;
  content: string;
}

export interface CreateNoteResult {
  id: string;
  title: string;
  content: string;
  created: true;
}

export interface ServiceHealthInput {
  serviceName: string;
}

export interface ServiceHealthResult {
  serviceName: string;
  status: 'healthy';
  checked: true;
}

export const greetCapability = createCapability<
  GreetInput,
  GreetResult
>({
  name: 'demo.greet',
  version: '1.0.0',
  description: 'Return a greeting for the supplied name.',
  risk: 'read',
  inputSchema: {
    name: {
      type: 'string',
      required: true,
      description: 'The person to greet.',
    },
  },
  async execute({ input }) {
    return {
      message: `Hello, ${input.name}!`,
    };
  },
});

export const createNoteCapability = createCapability<
  CreateNoteInput,
  CreateNoteResult
>({
  name: 'notes.create',
  version: '1.0.0',
  description: 'Create a deterministic simulated note.',
  risk: 'read',
  inputSchema: {
    title: {
      type: 'string',
      required: true,
      description: 'The note title.',
    },
    content: {
      type: 'string',
      required: true,
      description: 'The note content.',
    },
  },
  async execute({ input }) {
    return {
      id: `note-${input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: input.title,
      content: input.content,
      created: true,
    };
  },
});

export const serviceHealthCapability = createCapability<
  ServiceHealthInput,
  ServiceHealthResult
>({
  name: 'service.health',
  version: '1.0.0',
  description: 'Return a deterministic simulated service health status.',
  risk: 'read',
  inputSchema: {
    serviceName: {
      type: 'string',
      required: true,
      description: 'The service to check.',
    },
  },
  async execute({ input }) {
    return {
      serviceName: input.serviceName,
      status: 'healthy',
      checked: true,
    };
  },
});
