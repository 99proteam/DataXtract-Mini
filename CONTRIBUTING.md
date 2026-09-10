# Contributing to DataXtract Mini

Thank you for helping improve DataXtract Mini. Contributions of bug reports, documentation, tests, accessibility improvements, and focused code changes are welcome.

## Before you start

- Search existing issues and discussions before opening a duplicate.
- Use an issue for reproducible bugs and a discussion for support or open-ended ideas.
- Keep changes focused. Large unrelated rewrites are difficult to review.
- Do not include scraped personal data, credentials, session files, databases, or customer exports in commits.
- Follow the responsible-use expectations in the README.

## Local setup

```bash
git clone https://github.com/99proteam/DataXtract-Mini.git
cd DataXtract-Mini
npm install
npm test
npm run dev
```

Open `http://localhost:3007` after the server starts.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Add or update tests for behavior that changes.
3. Run `npm test` before submitting your pull request.
4. Update documentation when commands, settings, or user-visible behavior changes.
5. Submit a pull request using the provided template.

## Good first contributions

Issues labeled [`good first issue`](https://github.com/99proteam/DataXtract-Mini/labels/good%20first%20issue) are scoped for new contributors. Comment on an issue before starting significant work so effort is not duplicated.

## Pull-request expectations

- Explain the problem and the proposed solution.
- Include verification steps and screenshots for UI changes.
- Avoid committing generated builds, downloaded browser profiles, `.env` files, databases, or user data.
- Keep dependencies to the minimum required and explain why a new dependency is necessary.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
