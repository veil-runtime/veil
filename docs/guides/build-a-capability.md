---
title: Build a capability
---
# Build a capability

Use `createCapability` to define operation name, version, description, risk, optional input fields, and execution. Keep an operation small and give it an accurate risk. Its callback can call a local provider/client. Set `timeoutMs` to add the SDK timeout middleware; lifecycle logging is enabled unless `lifecycleLogging: false`. Then put it in a [module](compose-a-module.html).
