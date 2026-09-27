# Organizing a Figma Design System and Component Library

**Date:** 2026-09-24

**Scope:** External research on durable Figma library structure, component architecture, governance, and design/code parity.

This note intentionally does not restate the repository's `DESIGN.md`, the Figma plugin README, or issue #1165.
It provides the external evidence to combine with those project-specific sources.

## Executive Summary

The strongest recurring recommendation is to treat the Figma library as a governed product, not as a canvas containing every design artifact.
Begin with the fewest published libraries that provide a clear source of truth, arrange their contents in explicit layers, and split them only at real dependency or audience boundaries.

For a small or single-product team, the practical starting shape is:

1. A **Foundations** library containing primitive and semantic variables, typography and effect styles, and theme modes.
2. A **Mobile Components** library consuming Foundations and containing production-aligned primitives and composed components.
3. **Patterns, examples, and work in progress** kept outside the core published assets, either on clearly separated pages or in an unpublished working file.

If the current asset volume is modest, Foundations and Mobile Components can initially be pages in one published file, provided their dependency boundary and naming are already explicit.
Extracting a library later is safer than operating a premature multi-file graph, but letting one file grow into an unrestricted mega-library is also costly.

Across Figma, IBM Carbon, Atlassian, Shopify Polaris, and zeroheight, the operational pattern is consistent:

- semantic tokens alias primitives, and modes express contextual changes such as light and dark;
- component names and properties reflect meaning and align with code terminology;
- variants represent bounded semantic axes, while text, boolean, instance-swap, and slot properties handle content and composition;
- stable assets are separated from experiments;
- publication is reviewed, documented, and accompanied by migration information;
- an asset is not truly stable until design, code, documentation, and accessibility agree; and
- code and Figma stay linked through shared token names, component names, status, and inspectable implementation references.

## Source Quality and Selection

The research prioritized first-party material from Figma and public production design systems maintained by established product organizations.
No public readership or traffic data was available for most individual articles, so this note does not invent popularity metrics.
Authority is established by ownership: Figma documentation and accounts of Figma's own internal system; IBM's Carbon system; Atlassian Design System; Shopify Polaris; and zeroheight's specialist design-system guidance.

Dates below are publication or page-update dates exposed by the source.
Where a living documentation page exposes no date, it is marked **undated; accessed 2026-09-24**.

## Findings

### 1. File, page, and library structure

Figma defines a library as published components, styles, and variables that live in a source file and can be reused across files.
Consumers review and accept published updates rather than receiving uncontrolled copies.
Its official course recommends that a small team can begin with a single file organized into Welcome, Foundations, Components, and Patterns, then split by real needs such as foundations, icons, platform components, or a different audience.

The asset browser mirrors `file > page > frame`, while slash-delimited component names add another discoverable hierarchy.
The implication is that pages should be stable categories, frames or sections should group related families, and component names should not compensate for a chaotic file structure.

Zeroheight's guidance supplies the scaling counterweight: libraries with hundreds or thousands of components become slow and difficult to synchronize.
It recommends cascading smaller libraries from universal foundations into platform, product, or team libraries, with only the libraries relevant to a consumer enabled.
The split should follow dependencies and audiences, not an arbitrary page or component count.

**Actionable structure:**

- Keep product screens, feature explorations, and handoff mockups out of the component source-of-truth file.
- Use a cover/status page and a short getting-started page before the asset pages.
- Use stable pages such as `Foundations`, `Icons`, `Components`, `Patterns`, `Examples`, and `Archive`.
- Publish Foundations and Components; keep experiments and incomplete proposals unpublished or in a separate incubation file.
- Split icons only when their volume, ownership, or release cadence materially differs from components.
- Split by platform only when behavior or implementation genuinely differs; do not duplicate a universal component merely to create an iOS and Android folder.

Sources:

- [Figma, “Components collection: Library fundamentals”](https://help.figma.com/hc/en-us/articles/39723547036055-Components-collection-Library-fundamentals) — undated; accessed 2026-09-24; official product documentation.
- [Figma, “Lesson 3: Build your design system”](https://help.figma.com/hc/en-us/articles/14548865734679-Lesson-3-Build-your-design-system) — undated; accessed 2026-09-24; official design-system course.
- [Figma, “Name and organize components”](https://help.figma.com/hc/en-us/articles/360038663994-Name-and-organize-components) — undated; accessed 2026-09-24; official component organization documentation.
- [zeroheight, “How to organize your Figma files for your design system”](https://help.zeroheight.com/hc/en-us/articles/36473914948379-How-to-organize-your-Figma-files-for-your-design-system) — publication date not exposed; accessed 2026-09-24; specialist design-system platform guidance based on library synchronization experience.

### 2. Foundations, tokens, variables, and themes

Figma variables hold atomic reusable values and can be grouped in collections.
Modes express contexts such as light/dark, mobile/desktop, or language without duplicating token names.
Aliases let semantic variables reference primitive variables.

Figma's own Pattern Library rebuild used two essential color collections: primitive ramps organized by hue and scale, and semantic variables that alias the primitives and carry modes for themes and products.
It also established spacing and radius variables.
Figma then synchronized variables and code through its API and made the correct code names visible in Dev Mode.

Material's public token model independently reinforces the same layering: reference tokens hold raw palette values and system tokens give those values contextual roles.
Atlassian likewise describes tokens as the cross-design-and-code source of truth and uses semantic paths such as `color.icon.success`.

**Actionable token architecture:**

- Use `Primitive` and `Semantic` collections first; add component-scoped tokens only when a repeated component contract cannot be expressed cleanly with semantic tokens.
- Name primitives by measurable value or scale, such as `color/blue/600`, `space/300`, or `radius/full`.
- Name semantic aliases by purpose, such as `color/text/primary`, `color/surface/danger`, or `space/layout/gutter`.
- Model light/dark as modes on the semantic collection, not as duplicated `dark-*` tokens or duplicated component variants.
- Keep mode axes intentional; do not combine unrelated theme, density, and platform contexts in one opaque mode matrix.
- Keep token names stable across Figma and code and document any deliberate translation.
- Treat a raw color or spacing value inside a published component as an exception to review, not normal usage.

Sources:

- [Figma, “Overview of variables, collections, and modes”](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) — undated; accessed 2026-09-24; official feature documentation.
- [Figma, “The making of the Figma Pattern Library”](https://www.figma.com/blog/figma-pattern-library/) — published 2024-11-21; first-party account of Figma's internal production system.
- [Material Foundation, “Tokens Overview”](https://github.com/material-foundation/material-tokens/blob/main/tokens.md) — living official repository documentation; accessed 2026-09-24.
- [Atlassian Design System, “Design tokens”](https://atlassian.design/foundations/design-tokens) — undated; accessed 2026-09-24; Atlassian's public production-system guidance.

### 3. Component taxonomy, naming, variants, and properties

Figma recommends a documented naming structure and slash-separated categories such as `Component/State` or `Icon/Name`.
Names affect both discovery and instance swapping, so shallow and predictable taxonomy has direct usability value.
Semantic naming also creates a shared language with engineering; Figma's build guide recommends function-oriented names rather than appearance-oriented names.

Variants should represent genuine categorical differences such as size, hierarchy, state, or interaction.
They should not encode every combination of content.
Figma explicitly warns that every variant in a component set is imported, so very large variant matrices affect performance.

Component properties provide the more scalable alternative:

- text properties expose editable content;
- boolean properties show or hide optional parts;
- instance-swap properties constrain nested substitutions;
- variant properties select bounded structural or semantic states; and
- slots support free or repeating composition without detaching the instance.

Figma's management guidance recommends testing every property combination in a consuming file before publishing and favoring non-breaking additions over disruptive replacements when possible.

**Actionable component rules:**

- Use `Category/Component` or `Category/Component/Subcomponent`; avoid deep taxonomies that encode page location or implementation internals.
- Match component and property terminology to the public code API wherever that improves comprehension.
- Use lower-case semantic property values consistently, such as `size=small`, `tone=danger`, and `state=disabled`.
- Keep internal layer names stable and meaningful so overrides survive swaps and design inspection stays legible.
- Use variants only for a finite set of meaningful axes.
- Use boolean, text, and instance-swap properties instead of multiplying variants for icon presence, copy, or nested content.
- Do not group unrelated icons as variants; make icons a searchable family and use instance swap or a slot at the consuming component boundary.
- Prefer small composable components over feature-sized components with a combinatorial property matrix.

Sources:

- [Figma, “Design system 102: How to build a design system”](https://www.figma.com/blog/design-systems-102-how-to-build-your-design-system/) — published 2024-04-08; official Figma education.
- [Figma, “Components collection: Tips for component management”](https://help.figma.com/hc/en-us/articles/39747637290263-Components-collection-Tips-for-component-management) — undated; accessed 2026-09-24; official management guidance.
- [Figma, “Create and use variants”](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) — undated; accessed 2026-09-24; official variant documentation.
- [Figma, “Explore component properties”](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) — undated; accessed 2026-09-24; official component-property documentation.

### 4. Avoiding mega-libraries without premature fragmentation

There are two distinct failure modes:

1. One file becomes a dumping ground for tokens, icons, components, patterns, product screens, experiments, and obsolete work.
2. A small system is split into many interdependent libraries before ownership, audiences, or release cadences justify that graph.

Figma advises using fewer variants and component properties because Figma loads all components in a component set.
When a library still approaches memory limits, its official recommendation is to divide it into smaller libraries.
Zeroheight similarly recommends cascading libraries and warns about large-file editing and synchronization costs.

**A defensible split test:** create a separate library only when at least one of these is true.

- It has a different consumer audience.
- It has a different owner or permission boundary.
- It has a different platform contract.
- It has a materially different release cadence.
- Its asset volume or dependency loading harms authoring or consumption.
- It can form a clean dependency layer without circular references.

For most small product systems, `Foundations -> Components` is enough.
Icons can remain in Components until volume or ownership makes extraction useful.
Patterns can remain documentation/examples until they are stable, reusable assets with production counterparts.

Sources:

- [Figma, “Reduce memory usage in files”](https://help.figma.com/hc/en-us/articles/360040528173-Reduce-memory-usage-in-files) — undated; accessed 2026-09-24; official performance guidance.
- [zeroheight, “How to organize your Figma files for your design system”](https://help.zeroheight.com/hc/en-us/articles/36473914948379-How-to-organize-your-Figma-files-for-your-design-system) — publication date not exposed; accessed 2026-09-24.

### 5. Governance, lifecycle status, documentation, and contributions

Stable and experimental assets should not share an ambiguous surface.
Carbon created Carbon Labs as a separate Figma, Storybook, and repository environment after unfinished explorations beside stable components confused consumers about production safety.
Carbon requires new components to move through phased discovery and delivery and requires usage, style, code, and accessibility documentation.

Atlassian distinguishes small fixes from changes that need system-wide coordination across code, design, and guidance.
Its public system also attaches explicit lifecycle phases to assets.
Shopify Polaris similarly separates minor work from major or breaking work and requires proposals for major contributions that demonstrate a known gap, broad value, validation, impact, and ownership capacity.

**Recommended status model:**

- `proposal`: problem and evidence exist, but no reusable contract is approved;
- `experimental`: available for evaluation, not production guidance;
- `beta`: expected shape is present, but changes may still occur;
- `stable`: Figma, code, docs, and accessibility are complete and aligned;
- `deprecated`: still available during a documented migration window; and
- `retired`: removed from active discovery, with history preserved outside the published library.

Each component record should name its owner, design status, code status, accessibility review status, documentation link, implementation link, and replacement when deprecated.
Status should be text and metadata, not color or emoji alone.

**Contribution and review flow:**

1. Open a proposal that states the repeated need, affected products, existing alternatives, and evidence.
2. Confirm the need cannot be solved by existing tokens, properties, components, or patterns.
3. Explore outside the stable published surface.
4. Review design, API/property shape, accessibility, and code feasibility together.
5. Build or update Figma and code against the same agreed contract.
6. Test every state and property combination in a consumer file and in the implementation catalog.
7. Publish with a human-readable change description, status, migration notes, and links.
8. Monitor adoption, detachments, defects, and feedback before promotion to stable.

Sources:

- [Carbon Design System, “Contribution overview”](https://carbondesignsystem.com/contributing/get-started/overview/) — last updated 2026-09-23; IBM's official open-source design-system process.
- [Carbon Design System, “Component checklist”](https://carbondesignsystem.com/contributing/component-checklist/) — living official checklist; accessed 2026-09-24.
- [Atlassian Design System, “Contribution”](https://atlassian.design/contribution) — undated; accessed 2026-09-24; official contribution policy.
- [Atlassian Design System, “Release phases”](https://atlassian.design/release-phases) — undated; accessed 2026-09-24; official lifecycle policy.
- [Shopify Polaris, “Contributing to Polaris”](https://a71e.s5y-polaris-site-prod-ki-483d.prod.shopifyapps.com/contributing) — undated; accessed 2026-09-24; official public contribution guide.

### 6. Branching, publishing, release, and migration

Figma branches protect an approved main library while contributors explore and request review.
Figma frames branches as useful for design-library work specifically because unapproved work should not leak into production-ready assets.
This supports a trunk-and-review model rather than separate permanent WIP copies of the library.

Publishing remains a release event even when branch review is unavailable.
The maintainer should review visual changes, exercise downstream instances, explain the update, and give consumers control over accepting it.
Breaking changes need an overlap period in which the old component remains usable, is marked deprecated, and points to its replacement.

**Recommended release discipline:**

- Treat the main Figma library as the latest approved state.
- Use a branch for material library changes when the Figma plan supports branches; otherwise use a clearly named proposal file and merge changes under maintainer control.
- Review changes with a second designer and the implementation owner.
- Classify a release as additive, changing, breaking, or deprecating.
- Record a short changelog entry with affected tokens/components, code parity, migration action, and release date.
- Publish related token, component, documentation, and code changes in a deliberately coordinated window.
- Never delete a published component as the first step of a migration.

Sources:

- [Figma, “How (and why) we built branching”](https://www.figma.com/blog/how-and-why-we-built-branching/) — published 2021-10-12; official rationale for branch-and-review workflows.
- [Figma, “Review branch changes”](https://help.figma.com/hc/en-us/articles/5693123873687-Review-branch-changes) — undated; accessed 2026-09-24; official review workflow.
- [Figma, “Team Libraries in Figma”](https://www.figma.com/blog/team-libraries-in-figma/) — published 2017-02-15; original first-party publish/insert/update model, still useful as a source-of-truth principle.

### 7. Documentation and code parity

A component library is not the whole design system.
Documentation should explain purpose, when to use and not use an asset, properties and states, content guidance, accessibility behavior, and migration information.
The Figma source can hold concise designer-facing guidance, while Storybook or repository documentation holds executable examples and developer APIs.

Figma's internal Pattern Library made Code Connect support part of its definition of done.
It kept comprehensive documentation in the library and a separate engineering documentation site with use cases, APIs, and migration guides.
Carbon likewise requires usage, style, code, and accessibility guidance.
Shopify exposes the implemented Polaris component catalog in Storybook so production behavior is inspectable rather than inferred from static mockups.

Perfect structural identity between Figma and code is not always desirable.
Figma's internal team explicitly found that a one-to-one component tree was not always possible, so the durable requirement is a clear mapping of public concepts, tokens, states, and properties rather than identical internal nesting.

**Definition of done for a stable component:**

- Figma component and its supported states exist.
- Production implementation exists or the component is explicitly marked design-only.
- Public names and property semantics are mapped.
- System tokens are used on both sides.
- Light/dark and relevant accessibility states are verified.
- Usage, non-usage, content, and accessibility guidance exist.
- Figma links to implementation/docs and implementation docs link back to the design source.
- Design and code status agree.

Sources:

- [Figma, “The making of the Figma Pattern Library”](https://www.figma.com/blog/figma-pattern-library/) — published 2024-11-21.
- [Carbon Design System, “Component checklist”](https://carbondesignsystem.com/contributing/component-checklist/) — living official checklist; accessed 2026-09-24.
- [Shopify, “Polaris—unified and for the web”](https://www.shopify.com/partners/blog/polaris-unified-and-for-the-web) — published 2025-05-21; official Shopify announcement and component-catalog guidance.
- [zeroheight, “When's the right time to start documenting your design system?”](https://zeroheight.com/blog/whens-the-right-time-to-start-documenting-your-design-system/) — published 2025-10-01; specialist documentation guidance.

## Recommended Baseline Organization

This is an evidence-derived starting point to adapt after reconciling the repository's verified current state.

```text
Threadbase Design System
├── 00 Cover & status
├── 01 Getting started
├── 10 Foundations
│   ├── Color
│   ├── Typography
│   ├── Spacing
│   ├── Radius
│   ├── Elevation
│   └── Motion
├── 20 Icons
├── 30 Components
│   ├── Actions
│   ├── Inputs
│   ├── Navigation
│   ├── Feedback
│   ├── Overlays
│   ├── Data display
│   └── Layout
├── 40 Patterns
├── 50 Examples & QA
└── 90 Deprecated & migration
```

Numbered page prefixes keep Figma's alphanumeric browser order intentional.
The category names should be adjusted to the product's actual component inventory rather than filled speculatively.

Suggested variable collections:

```text
Primitive
├── color/*
├── space/*
├── radius/*
├── size/*
├── duration/*
└── easing/*

Semantic
├── color/text/*
├── color/icon/*
├── color/surface/*
├── color/border/*
├── space/layout/*
├── radius/control/*
└── motion/*
```

Suggested component metadata:

```text
Owner
Design status
Code status
Accessibility status
Documentation URL
Implementation or Storybook URL
Last reviewed date
Replacement and migration URL, when deprecated
```

## Practical Rollout Sequence

1. Inventory current published assets, local components, tokens, raw values, duplicates, detachments, and implementation counterparts.
2. Agree on terminology, status vocabulary, ownership, and the initial one-file or two-file boundary before moving assets.
3. Establish primitive and semantic collections, theme modes, and a mapping to code tokens.
4. Migrate a small, high-usage, accessibility-sensitive component family first and prove the end-to-end workflow.
5. Establish the page taxonomy, component naming rules, property rules, documentation template, and review checklist from that pilot.
6. Migrate remaining components by usage and risk, not alphabetically.
7. Move experiments and one-off feature compositions out of the core published surface.
8. Add lifecycle metadata, implementation links, deprecation paths, and a changelog.
9. Measure adoption, detachments, missing code counterparts, and stale assets; use the evidence to decide whether icons, patterns, or platform assets deserve separate libraries.

The pilot should be considered successful only when a designer can find and configure the component, a developer can locate its implementation and token mapping, light/dark behavior is correct, and a reviewed change can be published without breaking an existing consumer.

## Threadbase Recommendation

### Decision

Keep one Figma file and one code-owned generator for now, but replace the flat component canvas with explicit pages and a declarative catalog.
Threadbase is one mobile product with one implementation source, one theme-switching mechanism, and one maintainer workflow.
Splitting the system into multiple linked Figma files now would add cross-file variable, component, and release coordination without a demonstrated audience, ownership, or performance boundary.

Design the internal boundary as `Foundations -> Mobile Components -> Patterns -> Screens & QA` so Foundations or Icons can become a separate library later without renaming public assets.
Revisit a file split only when Figma performance measurably degrades, another product or platform needs an independently released subset, or ownership and permissions diverge.

### Alternatives considered

1. **Keep the current three pages and add better section labels.**
   This is the smallest change, but it leaves nearly two hundred component families in one discovery path and does not create a durable boundary between reusable assets, patterns, route compositions, and visual references.
2. **Use one file with domain pages and a generated catalog — recommended.**
   This improves discovery and governance while preserving same-file variables, component identities, plugin operation, and the existing Starter-plan theme mechanism.
3. **Split Foundations, Icons, and domain components into cascading library files.**
   This is appropriate only after a real dependency or audience boundary appears; today it increases operational risk and makes the plugin and theme switch more complex.

### Target page structure

```text
Threadbase Mobile Design System
├── 00 Start Here
├── 10 Foundations
├── 20 Core & Shared
├── 30 Sessions
├── 40 Conversation & Terminal
├── 50 Connectivity
├── 60 Product Experience
├── 70 Patterns
├── 80 Screens
├── 90 Visual QA
└── 99 Deprecated
```

- `00 Start Here` explains ownership, code-first provenance, the change workflow, lifecycle vocabulary, and links to repository documentation.
- `10 Foundations` keeps the public semantic collections, private theme palettes, type styles, spacing, radius, brand colors, and token examples together.
- `20 Core & Shared` holds general-purpose UI, shared chrome, reusable feedback, icons, and brand/provider marks.
- `30 Sessions` holds Now, Projects, tree, history, and session-state assets.
- `40 Conversation & Terminal` holds messages, thinking/tool/diff surfaces, composer, terminal, review, search, and question UI.
- `50 Connectivity` holds servers, pairing, browsing, connection health, encryption, and related alerts.
- `60 Product Experience` holds onboarding, tour, settings, diagnostics, notifications, quick access, shelf, and other product-level components.
- `70 Patterns` holds stable compositions made from components, such as dialogs, sheets, filters, status groups, and reusable flow fragments; feature experiments do not belong here.
- `80 Screens` holds one component-instance frame per app route and the onboarding flow, arranged by route rather than theme.
- `90 Visual QA` holds the theme-gallery references, audit matrices, and generated comparison fixtures; these are evidence, not reusable assets.
- `99 Deprecated` retains migration evidence for replaced assets while they remain supported and is excluded from normal discovery where Figma publishing controls allow it.

The numbered prefixes control page order only.
Public component names continue to match their React component names, so moving a component between pages does not change its identity or code mapping.
Use page and frame hierarchy for discovery, reserving slash names for true families such as `Icon/*`, `Mark/*`, and `Asset/*` rather than prefixing every component with its domain.

### Catalog and lifecycle

Replace the separate flat build-step list and source-link map in `design/figma-plugin/code.js` with one catalog entry per public asset.
Each entry should carry:

```js
{
  name: 'ChatComposer',
  builder: buildChatComposer,
  source: 'components/conversation/ChatComposer.tsx',
  page: '40 Conversation & Terminal',
  group: 'Composer',
  kind: 'component',
  status: 'stable',
}
```

Use `experimental`, `beta`, `stable`, `deprecated`, and `retired` as the initial lifecycle states.
Do not put status in public component names.
Render status and source information in page documentation and keep the implementation URL in `documentationLinks`.
A component becomes `stable` only when the Figma asset, production component, themes, repository documentation or Storybook story, and relevant accessibility behavior agree.

### Component architecture rules

- Keep token and property terms aligned with the public React API when that API is meaningful to a designer.
- Use variants for finite semantic axes such as `state`, `size`, `tone`, or `kind`.
- Use text properties for copy, booleans for optional layers, and instance-swap properties for icons or constrained nested components instead of expanding variant matrices.
- Keep intentionally fixed palettes explicit in the catalog or component description so theme-invariant visuals are distinguishable from raw-value defects.
- Keep component descriptions short: purpose, important constraints, lifecycle status, and source link.
- Build screens only from instances of cataloged components; do not detach instances to achieve route fidelity.
- Treat visual references as QA evidence and keep them out of the reusable component discovery path.

The current theme implementation remains intact in this reorganization.
The public `Color` aliases stay the component-facing contract, the raw theme palettes stay implementation detail, and `color/brand/*` remains theme-independent.
Changing the plan model or converting all themes into modes is out of scope for this organization pass.

## Threadbase Implementation Plan

### Phase 1: Make organization declarative without moving Figma nodes

**Repository changes**

- Add page, group, kind, and lifecycle constants to `design/figma-plugin/code.js`.
- Replace the independent build-step and source-link registries with one catalog, preserving the existing build order.
- Update `__tests__/unit/scripts/figma-plugin.test.js` to prove that names are unique, sources exist, builders exist, page/group/status values are valid, and every cataloged public component receives one source link.
- Update `DESIGN.md` and `design/figma-plugin/README.md` only for the catalog contract; do not describe the new live page layout until migration succeeds.

**Validation**

- Run the focused Figma plugin test file.
- Run `npm run test:scripts`.
- Run `git diff --check`.
- Confirm the generated builder sequence and source-link count are unchanged.

### Phase 2: Teach the plugin the new page structure

**Repository changes**

- Add idempotent page lookup/creation helpers keyed by the exact page names above.
- Separate the page receiving newly built nodes from global component lookup so a builder can instantiate dependencies from another page.
- Make component lookup root-wide and reject duplicate public names rather than silently selecting the first match.
- Route every catalog entry to its declared page and group while keeping its component node and variant names unchanged.
- Keep `80 Screens` and `90 Visual QA` as separate targets so route frames and reference screenshots no longer share a page.

**Validation**

- Extend structural tests for exact required pages, valid cross-page dependencies, duplicate detection, and the Screens/QA separation.
- Run the focused Figma plugin tests and `npm run test:scripts`.
- Use a read-only bridge job to inventory node IDs, page placement, component names, and instance counts before any live migration.

### Phase 3: Migrate the live file without recreating components

**Live Figma changes**

- Save a named Figma version before migration.
- Run one idempotent bridge job per destination page, moving existing component sections and main components rather than deleting and rebuilding them.
- Keep each job below the bridge's observed timeout window and record the completed page after every job.
- After each move, verify the same node IDs still exist, no duplicate public name was created, source links remain present, and representative existing instances still point to their main component.
- Move route frames to `80 Screens` and the theme-gallery evidence to `90 Visual QA` in separate jobs.
- Run the normal builder only after placement migration passes, so it fills missing assets rather than creating parallel families.

**Validation**

- Compare before/after counts for components, component sets, source links, route frames, and reference screenshots.
- Search globally for duplicate public component names.
- Open representative instances from every destination page and use “Go to main component” to confirm their connection.
- Switch through all eight existing themes and inspect one foundation sample, one core component, one component from each product domain, and the assembled route screens.

### Phase 4: Add navigation, status, and usage guidance

**Live Figma and documentation changes**

- Generate `00 Start Here` from repository-owned copy, including the change path, lifecycle definitions, naming rules, and links to `DESIGN.md`, the plugin README, and the implementation repository.
- Add one generated intro frame to every asset page with its scope, included groups, status legend, and contribution link.
- Mark the five not-yet-live-validated components from issue #1167 as `beta` until their bridge validation is complete; keep existing verified code-backed assets `stable` unless the audit finds a mismatch.
- Use `99 Deprecated` only when a replacement and migration note exist; do not use it as miscellaneous storage.

**Validation**

- Ask a consumer unfamiliar with the plugin to locate a core component, a domain component, its source, its supported properties, and a route example without canvas hunting.
- Confirm hidden or deprecated assets do not appear in normal published discovery where the current Figma plan supports that control.

### Phase 5: Fold the organization into the existing completion work

- Complete issue #1167's live validation before promoting its five components to `stable`.
- Implement issue #1166 route-by-route on `80 Screens`, starting with session detail and conversation as already specified there.
- Resolve issue #1168's intentional-versus-defect palette decisions and record deliberate fixed palettes in component descriptions/catalog metadata.
- Let issues #1169 and #1170 update the affected component representations after their app-side changes land.
- Close parent issue #1165 only after every sub-issue is complete, the live file has the target page structure, every route frame uses real instances, and all themes pass the visual smoke check.

### Commit and release boundaries

Use separate reviewable changes in this order:

1. Catalog and structural tests with no live Figma movement.
2. Cross-page plugin support and documentation updates.
3. Live-file migration, audit evidence, and any migration-only fixes.
4. Start Here/status guidance.
5. Remaining route screens and component parity work through the existing sub-issues.

Do not combine the repository refactor and live-file migration into one irreversible step.
Each phase ends with its issue status update, and no phase is complete until its repository checks and live validations appropriate to that phase are recorded.
