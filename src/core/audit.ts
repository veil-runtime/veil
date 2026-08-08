export interface AuditEntry {
  timestamp: string;
  capability: string;
  risk: string;
  approved: boolean;
  success: boolean;
  durationMs: number;
  error?: string;
}

export function writeAuditLog(entry: AuditEntry): void {
  console.log(
    JSON.stringify({
      type: 'capability_audit',
      ...entry,
    })
  );
}