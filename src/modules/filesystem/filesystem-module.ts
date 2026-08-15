import { filesystemFileReadCapability } from '../../capabilities/filesystem/file-read.js';

import {
  CapabilityModule,
} from '../../runtime/modules/capability-module.js';

export const filesystemModule: CapabilityModule = {
  manifest: {
    name: '@operator/filesystem',
    version: '0.1.0',
    description:
      'Filesystem capabilities for Operator',

    capabilities: [
      'filesystem.file.read',
    ],

    permissions: [
      'filesystem.read',
    ],

    operator: {
      minVersion: '0.1.0',
    },
  },

  capabilities: [
    filesystemFileReadCapability,
  ],
};