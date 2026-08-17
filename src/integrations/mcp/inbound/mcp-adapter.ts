import {
  randomUUID,
} from 'node:crypto';

import {
  McpServer,
} from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  OperatorRuntime,
} from '../../../runtime/operator-runtime.js';

import {
  ExecutionPlan,
} from '../../../runtime/planner/planner.js';

import {
  createMcpInputSchema,
} from './capability-schema.js';

export class McpAdapter {
  readonly server: McpServer;

  constructor(
    private readonly runtime: OperatorRuntime,
  ) {
    this.server =
      new McpServer({
        name: 'veil',
        version: '0.1.0',
      });

    this.registerCapabilities();
  }

  private registerCapabilities(): void {
    const capabilities =
      this.runtime.listCapabilities();

    for (
      const capability
      of capabilities
    ) {
      this.server.registerTool(
        capability.name,
        {
          description:
            capability.description,

          inputSchema:
            createMcpInputSchema(
              capability.inputSchema
            ),
        },
        async (input) => {
          try {
            const plan: ExecutionPlan = {
              version: '1.0',

              goal:
                `Execute MCP tool ${capability.name}`,

              metadata: {
                source: 'mcp',
                tool: capability.name,
              },

              steps: [
                {
                  id: randomUUID(),

                  capability:
                    capability.name,

                  input,

                  reason:
                    'Requested through MCP',

                },
              ],
            };

            const job =
              await this.runtime.executePlan(
                plan
              );

            const step =
              job.steps[0];

            if (!step) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text:
                      'Veil execution completed without a job step result',
                  },
                ],
                isError: true,
              };
            }

            if (
              step.status ===
              'failed'
            ) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text:
                      step.error ??
                      'Veil capability execution failed',
                  },
                ],
                isError: true,
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,

                  text:
                    JSON.stringify(
                      step.result ??
                        null,
                      null,
                      2
                    ),
                },
              ],
            };
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : 'Unknown Veil execution error';

            return {
              content: [
                {
                  type: 'text' as const,
                  text: message,
                },
              ],
              isError: true,
            };
          }
        }
      );
    }
  }
}
