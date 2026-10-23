# ADR 0005: Own Rive mascot sources and serve the runtime locally

- **Status:** Accepted implementation direction; character rig pending review
- **Date:** 2026-10-23
- **Decision owners:** Quilla maintainers
- **Related issue:** [Account-page branding / #78](https://github.com/devcedrick/quilla/issues/78)

## Context

The maintainer requested removal of hand-built CSS/SVG mascot animations and a transition to Rive CLI authoring. The approved Kuwi pose exists as a transparent PNG and traced SVG, not a character rig. Account availability and authentication must not depend on a decorative animation service or canvas.

## Decision

- Own a text-based RML project and shared asset contract in the repository. Build script-free local `.riv` exports with a checksum-pinned project-local CLI; do not authenticate, publish, sync, or purchase services implicitly.
- Begin with the exact approved pose in a motionless `AccountIdle` baseline. A working renderer does not mean a completed character animation. Native named parts and rigging require a separate visual review before enabling motion.
- Use the official React Canvas runtime as a lazy client enhancement. Its current 2D image content needs neither advanced renderer features nor a WebGL context.
- Commit reproducible `.riv` and versioned WASM artifacts and their runtime license. Normal application builds consume those artifacts; they do not install or contact the CLI. Serve both WASM variants from this application, not a CDN.
- Preserve a server-rendered SVG for no-JavaScript, reduced-motion, loading, timeout, and failure cases. No continuous motion or pause control is enabled for the static baseline.
- Keep the mascot decorative and independent of Clerk/Convex, credentials, learner state, authorization, and application data. Introduce no new backend endpoint, secret, CI workflow, deployment setting, or data schema.

## Alternatives and consequences

CSS transforms/clipped-image puppetry were rejected by the maintainer. A CDN-hosted embed would reduce local asset ownership but adds external availability/privacy dependencies. WebGL is unnecessary for this baseline and can be reconsidered if the authored rig requires advanced Rive features.

The self-hosted runtime adds binary weight (two WASM variants and one embedded-pose `.riv`). Lazy loading and the reduced-motion gate limit when they are fetched. Runtime upgrades must regenerate versioned assets, review licenses, and rerun browser failure/accessibility checks. A future signed-script/cloud-publishing workflow is not approved by this decision.

## Verification and rollback

Verify/inspect the RML and visually inspect a CLI-rendered frame. Test real canvas drawing, same-origin requests, failure fallbacks, preference changes, no-JavaScript rendering, and account navigation. The [Rive runbook](../brand/RIVE.md) records exact commands and pending rig work.

Rollback is to render the original SVG without the client enhancement. Keep the approved source/trace and account behavior unchanged; remove no identities or learner data.
