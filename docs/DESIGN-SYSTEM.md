# Nearmark visual system

## Art direction

Nearmark should feel like a security research instrument, not a speculative-token dashboard. The visual language uses editorial typography, technical labels, measured grid structure, quiet surfaces and a small number of meaningful state colours.

## Palette

| Token | Hex / value | Use |
|---|---|---|
| Graphite ink | `#0B0E0C` | Main canvas; low-glare dark field |
| Panel | `#111613` | Navigation, evidence and work surfaces |
| Elevated panel | `#151C17` | Forms, cards and grouped controls |
| Warm ivory | `#E9EEE6` | Primary text; softer than pure white |
| Muted sage | `#8D9A8D` | Secondary labels and long-form supporting copy |
| Acid lime | `#C9F66B` | Positive/verified state and primary action only |
| Signal coral | `#FF705D` | Threat, failure and destructive state only |
| Soft violet | `#B5A8FF` | AI analysis and attestation context |

Lime and coral are semantic signals, not decoration. A successful inspection must not turn every element green; unknown data remains neutral or amber. The same rule applies to threat states.

## Type

- Manrope: product headings, readable body copy and navigation.
- DM Mono: account IDs, hashes, measurements, labels and API details.
- Use tabular numerals for counters, rates and evidence values.

## Motion

- Motion for React handles route transitions, entrance reveals, and micro-interactions.
- Three.js renders a procedural authority lattice in the landing hero. It is generated in code and does not rely on an external model or stock illustration.
- Pointer movement influences the lattice; a visibility observer pauses rendering off-screen; a resize observer maintains aspect ratio; pixel ratio is capped for performance.
- `prefers-reduced-motion` disables continuous motion and hides the WebGL canvas in favour of a static mark.
- The dashboard is information-dense; avoid adding a heavy 3D canvas to every route.

## Responsive and accessibility rules

- Breakpoints at 1120px, 820px and 520px.
- Sidebar becomes a mobile drawer; forms and cards collapse to one column.
- Keyboard focus is visibly outlined with the lime accent.
- Interactive controls use native buttons, labels and inputs.
- Reduced-motion preferences are honoured.
- State is communicated with text labels as well as colour.

## Current frontend stack

As checked against package registries on 7 November 2026, the project pins compatible current stable release ranges for React 19.3, Vite 8.3, Motion 14.10, Three.js 0.187, React Router 7.18 and Lucide React 1.61. The frontend uses direct Three.js rather than React Three Fiber because the hero needs one small imperative scene, not a 3D component tree. This keeps the 3D dependency and rendering work concentrated in one route.
