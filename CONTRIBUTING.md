# Contributing

AgentDispatch packages are developed as separate repositories under the `agent-dispatch` GitHub organization. Keep public contracts in `@agent-dispatch/core` provider-neutral and avoid adding cloud-specific fields outside adapter-owned `details` or `providerRefs` objects.

Start with the [contributor map](./docs/contributor-map.md) if you are not sure which repository owns your change.

Run these checks before opening a pull request:

```bash
npm test
npm run typecheck
npm run build
```

Run the full local gate when changing cross-package behavior:

```bash
AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e
```
