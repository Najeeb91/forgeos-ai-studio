# ForgeOS Build Providers

The worker selects its execution implementation through `FORGEOS_BUILD_PROVIDER`.

Current:
- `local-process`: bounded real execution used by the launch runtime.
- `docker`: isolated real execution using a disposable Docker volume and container.

Docker mode:
- install phase uses network access only for dependency installation;
- build phase runs with `--network none`;
- container drops all Linux capabilities and uses no-new-privileges;
- build filesystem is read-only except the dependency volume;
- bounded CPU, memory, PIDs, duration, and output;
- Docker image is configurable with `FORGEOS_DOCKER_IMAGE`;
- the image must already exist on the host; ForgeOS does not silently pull arbitrary images.

Planned:
- `remote-vm`: disposable cloud VM execution.
- `kubernetes`: isolated job execution.
- `user-hosted`: execution on infrastructure controlled by the ForgeOS operator.

The worker API and ForgeOS persistence must not change when providers change. Provider-specific implementation belongs behind this boundary.

Railway is not referenced by the build provider itself. A Railway deployment can use Docker mode only when its runtime exposes a Docker daemon/image; otherwise keep `local-process` or move execution to a dedicated host/worker.

## Runtime health

The worker exposes provider health through `/worker/capabilities`. Each active provider reports its capability, configuration state, and whether real execution/deployment is available. Provider selection remains environment-driven and provider-specific health does not alter ForgeOS persistence or lifecycle state.
