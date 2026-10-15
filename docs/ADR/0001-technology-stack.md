# ADR 0001: Adopt the Initial Quilla Technology Stack

- **Status:** Accepted
- **Date:** 2026-10-14
- **Decision owners:** Quilla maintainers

## Context

Quilla is a web-based learning platform for Philippine Civil Service Examination candidates. The product must support authenticated users, concept-level mastery, adaptive practice, timed and autosaved exam attempts, daily study plans, content moderation, and an auditable admin experience.

The initial team needs to move quickly while keeping the application type-safe, accessible, maintainable, and capable of reacting to live data such as exam progress, review queues, contribution statuses, and admin moderation updates. The chosen tools should minimize custom infrastructure and work well together in a TypeScript codebase.

## Decision

Quilla will use the following initial stack:

| Concern                 | Technology                            | Decision rationale                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web application         | **Next.js 16 with React 19**          | Provides a single framework for routes, layouts, server rendering, client interactions, and production builds. Its App Router model suits a product with public pages, authenticated learner areas, exam flows, and admin screens.                                                                                              |
| Language                | **TypeScript**                        | Gives the application one typed language from UI to backend. Shared types reduce errors in question content, exam blueprints, attempts, mastery records, and role-aware workflows.                                                                                                                                              |
| Styling                 | **Tailwind CSS 4**                    | Enables fast, consistent UI construction without a growing collection of page-specific style sheets. Design tokens can represent Quilla's color, spacing, typography, and responsive behavior.                                                                                                                                  |
| UI components           | **shadcn/ui with Base UI primitives** | Supplies accessible, composable component patterns while keeping component source in the repository. Quilla can adapt components to exam interactions instead of depending on a closed visual system.                                                                                                                           |
| Backend and persistence | **Convex**                            | Provides a TypeScript-native database and backend function model with reactive queries, transactional mutations, scheduled work, generated client types, and managed infrastructure. These capabilities fit autosaved attempts, live progress, moderation queues, notifications, mastery updates, and spaced-review scheduling. |
| Authentication          | **Clerk integrated with Convex**      | Provides account and session management while allowing Convex functions to verify authenticated identity. This separates authentication from Quilla's own authorization rules for users, admins, ownership, suspension, and moderation.                                                                                         |
| Icons                   | **Lucide React**                      | Offers a consistent, lightweight icon set with React components and accessible labeling support. It avoids maintaining a custom icon library during early product development.                                                                                                                                                  |
| Complex animation       | **GSAP with `@gsap/react`**           | Supports deliberate, timeline-based animation for experiences that benefit from it, such as onboarding transitions, progress reveals, and learning feedback. It is reserved for interactions that exceed simple CSS transitions.                                                                                                |

Supporting UI utilities such as Class Variance Authority and class-name merging will be used to define typed component variants and resolve Tailwind class composition.

## Why this stack fits Quilla

### One typed application boundary

Next.js, TypeScript, and Convex keep most product behavior in the same language. Convex-generated types can flow into React components, reducing duplicated request and response definitions. This is especially valuable for entities with strict state transitions, including questions, attempts, reports, and contributions.

### Reactive learning data

Learner dashboards, due-review counts, attempt progress, contribution statuses, and moderation queues change over time. Convex's reactive data model allows these views to update without introducing a separate cache, websocket service, or synchronization layer.

### Reliable writes for exam workflows

Submitting an attempt can affect answers, scores, concept mastery, review schedules, and study plans. Convex mutations are transactional, which helps keep these related updates consistent. Business rules and authorization still need explicit implementation and testing.

### Fast UI delivery without surrendering control

Tailwind and shadcn/ui provide a productive starting point, while keeping visual decisions and component code under Quilla's control. This matters for keyboard-accessible exam interfaces and dense admin workflows that will need product-specific behavior.

### Managed identity with application-owned authorization

Clerk handles user identity and sessions. Convex remains responsible for enforcing who may read or change Quilla data. Client-side route protection is not considered sufficient authorization.

### Progressive enhancement of motion

Most state changes should use lightweight CSS transitions. GSAP is chosen for coordinated sequences where motion materially improves comprehension or orientation. Exam-taking interactions must remain usable when reduced motion is requested.

## Consequences

### Positive

- A single TypeScript-centered development model spans the client and backend.
- The team can deliver realtime and autosaved experiences with less custom infrastructure.
- UI components remain editable and can be adapted for accessibility requirements.
- Authentication plumbing is delegated to a focused provider.
- The stack supports incremental delivery from the current foundation through learning and admin features.

### Trade-offs and risks

- Convex and Clerk are managed-service dependencies. Outages, pricing, limits, and platform changes must be monitored.
- Authorization is still Quilla's responsibility. Every sensitive Convex function must derive identity from the authenticated context and enforce role and ownership checks.
- Next.js 16 differs from older Next.js conventions. Contributors must consult the versioned documentation installed with the project before changing framework behavior.
- shadcn/ui provides component source rather than a versioned black-box library, so Quilla owns maintenance of generated and customized components.
- GSAP can add bundle weight and distracting motion if used indiscriminately. It should be dynamically scoped where practical and must respect reduced-motion preferences.
- The backend remains portable at the domain-model level, but moving away from Convex would require rewriting persistence, reactive queries, and server functions.

## Guardrails

- Keep business rules in backend functions; never rely on hidden UI controls for enforcement.
- Validate all public backend function arguments and authorize access per resource.
- Preserve immutable question-version snapshots for historical exam attempts.
- Use server-derived Clerk identity in Convex; never trust a client-supplied user identifier as proof of identity.
- Prefer semantic HTML and keyboard interaction before adding animation.
- Use GSAP only when coordinated motion provides value beyond CSS.
- Treat generated Convex and Next.js guidance in the repository as version-specific authority.

## Alternatives considered

### Separate REST API with a relational database

A conventional API plus PostgreSQL would provide broad ecosystem portability and relational querying. It was not selected for the initial build because it would add API contracts, migrations, cache or realtime infrastructure, deployment configuration, and more operational surface area before Quilla validates its learning workflows.

### Firebase

Firebase offers managed authentication, data, and realtime features. Convex was preferred for its end-to-end TypeScript function model, generated types, transactional mutations, and direct fit with the application's server-side business rules.

### Custom authentication

Building passwords, verification, session management, and recovery in-house would give full control but would create unnecessary security risk and maintenance work. Clerk was selected so the team can focus on Quilla-specific authorization and learning behavior.

### A closed component library

A packaged visual library could speed up basic screens, but it would impose stronger design and behavior constraints. shadcn/ui was preferred because Quilla needs direct control over accessible exam controls and high-density admin interfaces.

### CSS-only animation

CSS remains the default for small transitions. GSAP was selected in addition for complex, interruptible, sequenced motion that would otherwise be difficult to coordinate and maintain.

## Follow-up decisions

Future ADRs should cover at least:

- authorization and role enforcement;
- the exam-attempt autosave and submission model;
- question versioning and historical snapshots;
- mastery scoring and spaced-repetition algorithms;
- notification delivery;
- deployment, observability, backup, and disaster recovery.
