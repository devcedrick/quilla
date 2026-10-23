# Kuwi Rive integration

Status: **native Rive waving and blinking on the account pages**.

The previous CSS float, eyelid overlays, and clipped-image wing were removed at the maintainer's request. The replacement deforms the unchanged approved PNG through a native Rive image mesh on a transparent 1368 × 1150 artboard. `AccountIdle` plays `Welcome wave and blink`: an eased shoulder-anchored double wave every 3.2 seconds and a short blink every 6.4 seconds. There is no whole-image floating, duplicate clipped limb, CSS eyelid, script, or cloud embed. This is a localized mesh rig, not a fully separated vector/skeletal character or an interactive expression system.

## Reproduce locally

Prerequisites: the repository's Node.js/npm installation and the system `tar` command. Supported CLI targets are Windows x64, Linux x64, and macOS ARM64.

```powershell
npm ci
npm run rive:install
npm run rive:rig
npm run rive:verify
npm run rive:build
```

The installer downloads **Rive CLI 1.7.0** from Rive's official release server, checks the pinned SHA-256, rejects unsafe archive entries and links, and extracts it into ignored `node_modules/.cache/quilla-rive/1.7.0`. It does not modify the user's PATH or install global tools. The wrapper disables CLI analytics and uses project-local CLI state. No Rive account, publishing, cloud sync, or credential access is required for this script-free baseline.

`rive:rig` regenerates the native scene from `scripts/kuwi-rive-scene.mjs` and verifies it. The build verifies the RML, inspects the artboard/state-machine/mesh/timeline contract, requires seamless vertex-only motion, refuses script/shader assets, builds with `--once`, and copies the `.riv` and exact installed Canvas WASM binaries into `public/brand/kuwi/rive/`. Generated binaries belong in version control so ordinary application builds need neither the CLI nor Rive network access. Regenerate them when source or runtime versions change; do not hand-edit binaries or the generated scene.

Read the generated scoped instructions in `assets/rive/kuwi-auth/AGENTS.md` before changing the scene. Query `schema` and `docs` rather than inventing RML attributes:

```powershell
node scripts/rive-tools.mjs schema MeshVertex
node scripts/rive-tools.mjs docs rigging
node scripts/rive-tools.mjs assets/rive/kuwi-auth --screenshot=assets/rive/kuwi-auth/build/rest.png --advance=1 --viewport=684x575 --fit=contain
node scripts/rive-tools.mjs assets/rive/kuwi-auth --screenshot=assets/rive/kuwi-auth/build/wave.png --advance=44 --viewport=684x575 --fit=contain
node scripts/rive-tools.mjs assets/rive/kuwi-auth --screenshot=assets/rive/kuwi-auth/build/blink.png --advance=160 --viewport=684x575 --fit=contain
```

Inspect all three PNGs, not just the resting frame. The CLI defaults to layout fitting; `--fit=contain` is essential when capturing a smaller viewport without a responsive artboard layout. Direct Node commands avoid PowerShell/npm swallowing CLI flags. Source changes outside the project directory require a manual rebuild.

## File sequence

1. `scripts/kuwi-rive-scene.mjs`: editable mesh topology, eye remapping, shoulder deformation, and timeline generator. It preserves source pixels and uses exact eyelid boundary vertices to prevent stretched pupils.
2. `assets/rive/kuwi-auth/scene.rml`: generated native Rive scene referencing the approved source PNG; no duplicated image source.
3. `assets/rive/kuwi-auth/rive.yaml`: artboard selection and local build logs.
4. `lib/brand/kuwi-rive.json`: shared artboard, state-machine, dimensions, URLs, action cadence, and runtime version contract.
5. `scripts/rive-tools.mjs`: pinned install, verification, inspection, and asset reproduction.
6. `public/brand/kuwi/rive/`: generated `.riv`, versioned WASM files, and runtime license.
7. `components/auth/welcome-mascot.tsx`: server-rendered SVG fallback and existing display dimensions.
8. `components/auth/rive-mascot.tsx`: client-only loader, reduced-motion subscription, eight-second failure deadline, and error boundary; no playback controls.
9. `components/auth/rive-welcome-runtime.tsx`: lazy-loaded Canvas runtime, visibility-aware playback, contract validation, and lifecycle cleanup through the official React hook.

## Runtime behavior

- Official `@rive-app/react-canvas` **4.37.1** and Canvas **2.45.1** are exact dependencies. Canvas is also direct because the reproduction script consumes its WASM files.
- Both primary and fallback WASM URLs are same-origin. Do not let the runtime silently fall back to a CDN or send learner/authentication data to Rive.
- The decorative canvas is hidden from assistive technology and excluded from tab order. Credential fields, identity, sessions, and validation remain wholly outside the mascot.
- SSR and no-JavaScript pages show the original SVG. Initial reduced-motion preference loads neither the Rive module nor `.riv`/WASM resources. Preference changes unmount or restore the enhancement.
- The SVG remains visible during module/file/runtime loading and on errors or timeout. Successful load validates `AccountIdle`, sizes/draws the canvas, then reveals it. Playback starts automatically once the loaded illustration is visible. At the maintainer's request there is no play/pause button or manual playback state.
- Playback pauses while the illustration is outside the viewport or `document.hidden` is true, and resumes automatically when visible again. Reduced-motion changes unmount the enhancement entirely. The operating-system preference remains respected, but the page no longer offers an independent pause control; do not claim a complete WCAG moving-content conformance audit.
- The official hook owns native teardown. Do not call `pause()` in a later effect cleanup after the hook has deleted its WASM instance; that formerly caused a route-level error when changing motion preference. Playback exceptions switch to the static fallback instead of affecting authentication.
- Canvas 2.45.1's changed-only drawing optimization intermittently leaves this vertex-animated mesh frozen. `drawingOptions: DrawOptimizationOptions.AlwaysDraw` requests native redraws during playback. Browser tests compare actual decorative pixels without user interaction, prove a hidden-page interval is stable, and recheck automatic resume; a playback-state attribute alone is insufficient. Hidden and offscreen instances still stop playback.
- The React runtime owns cleanup and responsive canvas resizing. Next Cache Components may retain an inactive page's DOM in a hidden Activity; navigation checks must not confuse hidden cached markup with visible account content.
- The canvas display size is explicitly constrained to 100% of its host. Rive's inline pixel-size update follows a ResizeObserver callback; display sizing must remain responsive even before that callback updates framebuffer dimensions. Do not conceal overflow to mask this race.

## Native rig and visual verification

The mesh has 4,355 vertices and 8,448 triangles. All keyed objects target native vertex positions, never the image/artboard transform. A 384-frame loop at 60 fps carries two eased double-wave gestures (starting frames 28 and 220) and one blink (frames 153–170, closed 159–162). First/last values match for a seamless 6.4-second cycle. Eye remapping is monotonic; wave weighting follows the transparent head/wing gap and uses broad, smooth transitions. The previous horizontal gate crossed the upper feather and inverted its triangles during lift, producing the reported cutoff. An orientation regression now samples the wave domain at its extrema. Feet and clockwise Q-tail stay anchored; no overflow mask hides the defect.

CLI frames at 684 × 575 were inspected at rest, peak wave, and closed eyes. Pixel comparisons locate waving within the shoulder/wing region and blinking within the eye region; the head, feet, and Q-tail are byte-identical during waving. The repeated wave at frame 236 differs from frame 44 by at most one RGB level (floating-point rendering), not a different pose. No authentication page or identity is captured by these CLI renders. Review any future geometry change at these frames and intended page sizes; keep motion inside `.riv`, not DOM transforms. Broader actions or a fully separated vector rig remain future work.

Earlier, pre-clipping-fix CLI benchmark (`node scripts/rive-tools.mjs assets/rive/kuwi-auth --bench=384`): at the reported 1368 × 1150 viewport, mean advance 0.569 ms (p95 1.303 ms), mean render 5.016 ms (p95 5.521 ms, maximum 43.350 ms), and no reported WASM-page growth. This historical measurement is not a benchmark of the revised influence region or a cross-device browser frame-rate guarantee.

`rive login`, `push`, `pull`, `--publish`, and `--rev` are not part of this workflow. Obtain explicit approval before cloud uploads or account operations. Unsigned scripts cannot ship to web runtimes; future scripted scenes require a separate publishing/signing decision. No paid plan is required or purchased for the current script-free local build.

Official references: [CLI getting started](https://rive.app/docs/cli/getting-started), [CLI commands](https://rive.app/docs/cli/reference/commands), [RML](https://rive.app/docs/runtimes/advanced-topic/rml), [React runtime](https://rive.app/docs/runtimes/react/react), [runtime license](https://github.com/rive-app/rive-wasm/blob/master/LICENSE).
