import { ExecutionLogEntry } from '../execution/execution-logger.js';

import { reportLoggingFailure } from './logging-diagnostic.js';

import { ExecutionLogSink } from './execution-log-sink.js';

export class CompositeLogSink
  implements ExecutionLogSink
{
  constructor(
    private readonly sinks: ExecutionLogSink[]
  ) {}

  async write(
    entry: ExecutionLogEntry
  ): Promise<void> {
    await Promise.all(
      this.sinks.map(
        async (sink) => {
          try {
            await sink.write(entry);
          } catch {
            reportLoggingFailure();
          }
        }
      )
    );
  }
}