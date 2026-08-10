import { capabilityRegistry } from './registry.js';

import { linkedinAuthStatusCapability } from '../../capabilities/linkedin/auth-status.js';
import { linkedinSelfProfileCapability } from '../../capabilities/linkedin/profile-self.js';
import { webPageReadCapability } from '../../capabilities/web/page-read.js';
import { filesystemFileReadCapability } from '../../capabilities/filesystem/file-read.js';

export function registerCapabilities(): void {
  capabilityRegistry.register(linkedinAuthStatusCapability);
  capabilityRegistry.register(linkedinSelfProfileCapability);
  capabilityRegistry.register(webPageReadCapability);
  capabilityRegistry.register(filesystemFileReadCapability);
}