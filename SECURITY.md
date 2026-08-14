# Security Policy

## Supported Versions

Veil is currently in active pre-release development.

Security fixes are applied to the latest development version only.

| Version | Supported |
| ------- | :-------: |
| main (pre-v0.1.0) | ✅ |
| Older snapshots | ❌ |

Once Veil reaches `v0.1.0`, supported release branches and their security support windows will be documented here.

---

## Reporting a Vulnerability

If you believe you have discovered a security vulnerability in Veil, please report it privately.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, use GitHub's **Private Vulnerability Reporting** feature if it is enabled for the repository. If it is not available, please contact the maintainers directly.

Please include, where possible:

- A description of the vulnerability
- The affected version or commit
- Steps to reproduce the issue
- Potential impact
- Any suggested remediation

---

## What to Expect

After receiving a report, the maintainers will:

1. Acknowledge receipt of the report.
2. Investigate and validate the issue.
3. Determine its impact and severity.
4. Develop and test an appropriate fix.
5. Coordinate responsible disclosure where appropriate.
6. Publish a security advisory once a fix is available.

Not every report will result in a security advisory, but every report will be reviewed.

---

## Scope

Veil is an execution platform. Security is a core design goal.

Reports involving any of the following are particularly valuable:

- Capability permission bypasses
- Execution sandbox escapes
- Policy enforcement failures
- Privilege escalation
- Authentication or authorization issues
- Secrets exposure
- Arbitrary code execution
- Supply-chain vulnerabilities
- Dependency-related security issues

---

## Security Principles

Veil is designed around a small number of core security principles:

- Explicit capabilities
- Governed execution
- Least privilege
- Observable execution
- Replaceable reasoning
- Stable execution contracts

Security improvements are treated as architectural improvements and are incorporated into the platform whenever appropriate.
