import { capabilityRegistry } from './registry.js';
import { linkedinAuthStatusCapability } from '../skills/linkedin/auth-status.js';
import { linkedinSelfProfileCapability } from '../skills/linkedin/profile-self.js';
import { webPageReadCapability } from '../skills/web/page-read.js';

export function registerCapabilities(): void {
  capabilityRegistry.register(linkedinAuthStatusCapability);
  capabilityRegistry.register(linkedinSelfProfileCapability);
  capabilityRegistry.register(webPageReadCapability);
}