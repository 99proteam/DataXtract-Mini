# Security policy

## Supported versions

Security fixes are applied to the latest release and the current `main` branch.

| Version | Supported |
|---|---|
| Latest release | Yes |
| `main` | Yes |
| Older releases | No |

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could put users or their data at risk.

Email `support@bundlewp.com` with:

- the affected component and version or commit;
- reproduction steps or a minimal proof of concept;
- the potential impact;
- any suggested mitigation.

Do not include real credentials, personal data, or data collected from third parties. We will acknowledge a valid report as soon as practical, investigate it, and coordinate disclosure after a fix is available.

## Operational security

- Keep `.env`, `data/settings.json`, databases, exports, and browser session directories private.
- Use dedicated, least-privilege credentials for optional services.
- Test campaigns with controlled recipients before broader use.
- Keep Node.js, Chrome or Edge, and dependencies updated.
