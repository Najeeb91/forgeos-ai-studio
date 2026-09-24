# ForgeOS deployment refresh

This file intentionally records the 2026-09-24 production refresh trigger after the Builder UI/runtime was verified on `main`.

Source of truth: `main`.

The deployed control-plane application must be built from the current `main` revision so the Builder exposes the real `Start Build` flow rather than the stale `Plan change` UI.
