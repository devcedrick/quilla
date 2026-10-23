# Generated Kuwi Rive assets

Regenerate the native scene with `npm run rive:rig`, then export with `npm run rive:build`; see [the runbook](../../../../docs/brand/RIVE.md).

- `kuwi-auth.riv`: Rive CLI 1.7.0 build of `assets/rive/kuwi-auth`, 1,320,055 bytes. The unchanged approved PNG is embedded in a native image mesh. `AccountIdle` automatically loops the 60 fps, 384-frame `Welcome wave and blink` timeline (wave every 3.2 seconds, blink every 6.4 seconds), with no playback buttons. Smooth, non-folding wing influence preserves the upper feather at peak lift.
- `runtime-2.45.1.wasm`: official Canvas 2.45.1 runtime, 2,128,716 bytes.
- `runtime-2.45.1-fallback.wasm`: matching fallback runtime, 2,155,107 bytes.

The runtime binaries are redistributed under [Rive's MIT license](LICENSE.txt). That notice applies to the runtime, not ownership of the Quilla mascot artwork. Both WASM URLs remain same-origin. Unit tests check the shipped WASM against the installed package and check the `.riv` contains the unchanged approved PNG.
