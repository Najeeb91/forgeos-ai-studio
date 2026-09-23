# ForgeOS Build Providers

The worker selects its execution implementation through `FORGEOS_BUILD_PROVIDER`.

Current:
- `local-process`: bounded real execution used by the launch runtime.

Planned:
- `docker`: isolated local/container execution.
- `remote-vm`: disposable cloud VM execution.
- `kubernetes`: isolated job execution.
- `user-hosted`: execution on infrastructure controlled by the ForgeOS operator.

The worker API and ForgeOS persistence must not change when providers change. Provider-specific implementation belongs behind this boundary.

Railway is not referenced by the build provider itself.
