# Release checklist

1. Confirm `main` is clean and up to date.
2. Update `package.json` version and `docs/CHANGELOG.md`.
3. Run `npm ci` and `npm test`.
4. Test `npm run deploy` on a clean folder.
5. Verify extraction, verification, export, and settings workflows.
6. Check that no credentials, databases, exports, or browser sessions are tracked.
7. Create and push an annotated `vX.Y.Z` tag.
8. Confirm the release workflow publishes the source release and notes.
9. Verify installation from the release source archive on a clean machine.
10. Announce the release with a short demonstration and link to the release page.
