import {
  createCapability,
} from '@veil-runtime/core';

export interface GreetInput {
  name: string;
}

export interface GreetResult {
  message: string;
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
