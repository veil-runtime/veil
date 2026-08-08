import { FastifyInstance } from 'fastify';
import { capabilityRegistry } from '../../runtime/registry/registry.js';
import { checkPermission } from '../../runtime/permissions/permissions.js';
import { writeAuditLog } from '../../runtime/audit/audit.js';

interface ExecuteParams {
  name: string;
}

interface ExecuteBody {
  input?: unknown;
  approved?: boolean;
}

export async function executionRoutes(app: FastifyInstance) {
  app.post<{
    Params: ExecuteParams;
    Body: ExecuteBody;
  }>('/capabilities/:name/execute', async (request, reply) => {
    const capability = capabilityRegistry.get(request.params.name);

    if (!capability) {
      return reply.status(404).send({
        error: 'Capability not found',
        capability: request.params.name,
      });
    }

    const approved = request.body?.approved === true;

    const permission = checkPermission(
      capability.risk,
      approved
    );

    if (!permission.allowed) {
      writeAuditLog({
        timestamp: new Date().toISOString(),
        capability: capability.name,
        risk: capability.risk,
        approved,
        success: false,
        durationMs: 0,
        error: permission.reason,
      });

      return reply.status(403).send({
        capability: capability.name,
        risk: capability.risk,
        requiresApproval: permission.requiresApproval,
        reason: permission.reason,
      });
    }

    const started = Date.now();

    try {
      const result = await capability.execute(
        request.body?.input
      );

      writeAuditLog({
        timestamp: new Date().toISOString(),
        capability: capability.name,
        risk: capability.risk,
        approved,
        success: true,
        durationMs: Date.now() - started,
      });

      return {
        capability: capability.name,
        risk: capability.risk,
        result,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown capability execution error';

      writeAuditLog({
        timestamp: new Date().toISOString(),
        capability: capability.name,
        risk: capability.risk,
        approved,
        success: false,
        durationMs: Date.now() - started,
        error: message,
      });

      throw error;
    }
  });
}