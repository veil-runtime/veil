# v1.1 to v1.2 effective model-context comparison

The v1.1 driver supplied `experiments/emergent-coordination/phase2/protocol.md`
as the `protocol` field. The v1.2 driver supplies
[`action-protocol.md`](./action-protocol.md), which is the v1.1 protocol with
one appended recipient-rule sentence.

| Model-visible field | v1.1 to v1.2 change | Control | Treatment |
|---|---|---|---|
| `protocol` | Adds only: “A message may be addressed to another participant or `all`. A participant may not address a message to itself.” | Visible | Visible |
| `observation.peerCapabilities` | None | Absent | Present, static peer IDs and capability descriptors only |
| Prompts, history, memory, audience, base observation | None | Same | Same, apart from the preregistered directory |

The offline suite captures actual v1.1 and v1.2 model contexts under matched
seed/configuration and asserts that removing the `protocol` field makes each
same-condition context equal. It separately asserts that removing
`peerCapabilities` makes v1.2 control and treatment contexts equal. The
directory assertions check descriptor-only keys and reject receipts, status,
inbox/history, memory, raw values, scopes, and evaluator fields.

Thus the only intended shared context change is the recipient clarification;
the only condition difference remains the peer-capability directory.
