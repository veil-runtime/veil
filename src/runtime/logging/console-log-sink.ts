import {
  ExecutionLogEntry,
  ExecutionLogLevel,
} from '../execution/execution-logger.js';

import { ExecutionLogSink } from './execution-log-sink.js';

export class ConsoleLogSink
  implements ExecutionLogSink
{
  write(entry: ExecutionLogEntry): void {
    const output = JSON.stringify({
      type: 'execution_log',
      ...entry,
    });

    this.writeToConsole(
      entry.level,
      output
    );
  }

  private writeToConsole(
    level: ExecutionLogLevel,
    output: string
  ): void {
    switch (level) {
      case 'debug':
        console.debug(output);
        break;

      case 'warn':
        console.warn(output);
        break;

      case 'error':
        console.error(output);
        break;

      default:
        console.info(output);
    }
  }
}