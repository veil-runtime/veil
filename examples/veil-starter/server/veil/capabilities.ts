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

export interface CustomerLookupInput {
  customerId: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  plan: string;
}

export interface EmailDraftInput {
  customer: Customer;
  issue: string;
}

export interface EmailDraftResult {
  to: string;
  subject: string;
  body: string;
  status: 'drafted';
}

const customers: Readonly<Record<string, Customer>> = {
  'CUST-001': {
    id: 'CUST-001',
    name: 'Amina',
    email: 'amina@example.com',
    plan: 'Business',
  },
};

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

export const customerLookupCapability = createCapability<
  CustomerLookupInput,
  Customer
>({
  name: 'customer.lookup',
  version: '1.0.0',
  description: 'Look up a deterministic customer fixture.',
  risk: 'read',
  inputSchema: {
    customerId: {
      type: 'string',
      required: true,
      description: 'The customer identifier to look up.',
    },
  },
  async execute({ input }) {
    const customer = customers[input.customerId];
    if (!customer) {
      throw new Error(`Customer not found: ${input.customerId}`);
    }

    return customer;
  },
});

export const emailDraftCapability = createCapability<
  EmailDraftInput,
  EmailDraftResult
>({
  name: 'email.draft',
  version: '1.0.0',
  description: 'Prepare a deterministic customer support email draft.',
  risk: 'read',
  inputSchema: {
    customer: {
      type: 'object',
      required: true,
      description: 'The customer receiving the draft.',
    },
    issue: {
      type: 'string',
      required: true,
      description: 'The customer issue to address.',
    },
  },
  async execute({ input }) {
    return {
      to: input.customer.email,
      subject: 'Regarding your account access',
      body: `Hi ${input.customer.name}, we received your message about ${input.issue}. We will help you restore access to your ${input.customer.plan} account.`,
      status: 'drafted',
    };
  },
});
