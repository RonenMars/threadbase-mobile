---
name: threadbase-design
description: Use this skill to generate well-branded interfaces and assets for Threadbase, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key files:
- `design/README.md` — voice, content fundamentals, visual foundations, iconography
- `design/colors_and_type.css` — single source of truth for color/type CSS variables; import on every page
- `design/assets/threadbase-icon.svg`, `design/assets/threadbase-icon-chat.svg` — brand marks
- `design/preview/` — small HTML cards illustrating colors, type, components
- `design/ui_kits/mobile/` — high-fidelity recreation of the Threadbase mobile app

Quick brand summary: dark IDE-grade canvas (#070b11), cyan-blue (#63b3ff) for "thread / data / past", amber (#f08a24) for "live / running / now". Inter + JetBrains Mono. No purple gradients, no emoji-as-UI, no bounce animations. Glow is the brand's expressive move.
