import { capabilityRegistry } from './registry.js';
import { operatorRuntime } from '../operator-runtime.js';
import { filesystemModule } from '../../modules/filesystem/filesystem-module.js';

import { linkedinAuthStatusCapability } from '../../capabilities/linkedin/auth-status.js';
import { linkedinSelfProfileCapability } from '../../capabilities/linkedin/profile-self.js';
import { webPageReadCapability } from '../../capabilities/web/page-read.js';
import { filesystemFileReadCapability } from '../../capabilities/filesystem/file-read.js';
import { shellCommandRunCapability } from '../../capabilities/shell/command-run.js';
import { httpRequestCapability } from '../../capabilities/http/request.js';

export function registerCapabilities(): void {
  capabilityRegistry.register(linkedinAuthStatusCapability);
  capabilityRegistry.register(linkedinSelfProfileCapability);
  capabilityRegistry.register(webPageReadCapability);
  operatorRuntime.use(filesystemModule);
  capabilityRegistry.register(shellCommandRunCapability);
  capabilityRegistry.register(httpRequestCapability);
}