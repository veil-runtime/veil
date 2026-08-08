import { randomUUID } from 'node:crypto';

import { capabilityRegistry } from '../../registry/registry.js';
import { PlannerProvider } from '../planner-provider.js';
import { ExecutionPlan } from '../planner.js';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface PlannerResponse {
  steps: Array<{
    capability: string;
    input?: unknown;
    reason?: string;
  }>;
}

export class OpenAICompatiblePlannerProvider
  implements PlannerProvider
{
  readonly name: string;

  constructor(
    name: string,
    private readonly baseUrl: string,
    private readonly model: string
  ) {
    this.name = name;
  }

  async plan(goal: string): Promise<ExecutionPlan> {
    const capabilities = capabilityRegistry.list();

    const response = await fetch(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `
You are a planner for Operator Runtime.

You do not execute actions.

You select capabilities from the supplied catalogue.

Return ONLY valid JSON in this format:

{
  "steps": [
    {
      "capability": "capability.name",
      "input": {},
      "reason": "short explanation"
    }
  ]
}

Rules:
- Use only capabilities from the supplied catalogue.
- Never invent capability names.
- Return the smallest useful plan.
- Do not include markdown.
- Do not include explanations outside the JSON.
              `.trim(),
            },
            {
              role: 'user',
              content: JSON.stringify({
                goal,
                capabilities,
              }),
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Planner request failed: ${response.status} ${response.statusText}`
      );
    }

    const payload =
      (await response.json()) as ChatCompletionResponse;

    const content =
      payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Planner returned no content');
    }

    let parsed: PlannerResponse;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(
        `Planner returned invalid JSON: ${content}`
      );
    }

    if (!Array.isArray(parsed.steps)) {
      throw new Error('Planner response contains no steps');
    }

    return {
      steps: parsed.steps.map((step) => {
        if (!capabilityRegistry.get(step.capability)) {
          throw new Error(
            `Planner selected unknown capability: ${step.capability}`
          );
        }

        return {
          id: randomUUID(),
          capability: step.capability,
          input: step.input,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
      }),
    };
  }
}