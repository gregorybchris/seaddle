# Seaddle

A route-building site for new cyclists around Seattle. It does not store routes.
It stores a **graph** — junctions, and segments of real road between them, cut
from GPX rides actually ridden — and a rider builds a route by clicking their way
outward from one segment to the next. Every segment carries hand-reviewed
attributes (steepness, protection, surroundings) so a beginner can say "nothing
steeper than rolling, at least a bike lane" and be told the truth.

There is no backend. The route lives in the URL, saves live in `localStorage`,
GPX export happens in the browser, and the whole thing deploys to Vercel as
static files.

## Read these before ranging around the code

- **[`README.md`](README.md)** — setup, the data-flow diagram, every `pnpm`
  command, deploy notes. Read it first; this file does not repeat it.
- **[`specs/index.md`](specs/index.md)** — the design document, and the reason
  behind most decisions you'll encounter. Numbered sections: source data, data
  model, build pipeline, the site, admin, style, conventions, milestones, open
  questions. **§8 Milestones is the live status of the project** — what is done,
  what is still open.
- **[`specs/auto-routing.md`](specs/auto-routing.md)** — connectors (routing a
  rider from their door to the graph). Specified, **not built**.
- **[`planning/planning.md`](planning/planning.md)** — a scratch TODO list.

## Code map

| Path            | What lives there                                                                    |
| --------------- | ----------------------------------------------------------------------------------- |
| `src/lib/`      | Pure logic, no React. Geometry, graph traversal, GPX read/write, models, utilities. |
| `src/site/`     | The public app: route building, filters, encoding, hooks, and its own components.   |
| `src/admin/`    | The graph editor. **Development only** — never in the production bundle.            |
| `src/widgets/`  | Generic, project-agnostic UI (button, dialog, sheet, sparkline, stat).              |
| `src/pages/`    | `map-page.tsx` — the one real page, which owns route state.                         |
| `src/db/`       | The authored graph: `graph.json`, `geometry/*.json`. Committed and diffable.        |
| `scripts/`      | The pipeline: `gpx-import`, `graph-build`, `geometry-rebuild`, `attributes-seed`, … |
| `vite-plugins/` | `admin-api.ts` — the dev-only middleware the admin writes through.                  |
| `public/`       | Static assets, plus the two **generated** GeoJSON files the site fetches.           |

`src/site/components/` and `src/admin/components/` hold components tied to that
surface; `src/widgets/` holds the ones that aren't. Keep that line.

## The things that will bite you

**Authored vs. derived.** `src/db/` contains only what cannot be computed from
something else. Length, elevation gain, and every other derived number are worked
out in `graph:build` and nowhere else. Do not add a derived field to an authoring
file, and do not measure anything in the browser — the site displays numbers the
build computed.

**Generated files are not yours to edit.** `public/graph.geojson` and
`public/pins.geojson` are gitignored and rebuilt by `dev` and `build`. So are
`src/db/tracks/` (from `gpx:import`) and `dist/`. Change the source, run the
script.

**`src-gpx/` and `src/db/tracks/` are local-only and probably absent.** The
source rides start at the author's home, so they never leave the machine. Tests
use `test-fixtures/sample-loop.gpx` instead, and `pnpm build` compiles the
committed graph rather than the rides it was cut from — so a fresh clone works
without them. Anything touching the admin's candidate finder or extraction,
though, has no real data to run against locally.

**The admin's security model is that it doesn't ship.** `import.meta.env.DEV` is
a build-time literal, so the admin page, its API, and everything they import are
dead code in production. Don't undermine that by importing admin code from site
code.

**No router, and no new dependency without a reason.** There are two pages and
one comparison decides between them. The bundle is already over the gzipped
budget spec §6 sets for it, so weight is a live concern.

## Conventions

- **kebab-case filenames**, named exports, `@/` alias for `src/`.
- **Four words, one meaning each.** A **segment** is an edge of the graph; a
  **route** is what a rider builds out of them. "Road" is only ever the physical
  roadway or the basemap's own road web, and "ride" is only ever a source GPX
  ride or the verb. This holds in copy, comments, identifiers and filenames
  alike — the two pairs were used interchangeably once and it read as two
  different models of the same thing.
- **Comments explain _why_**, not what — usually the alternative that was
  rejected and the reason. The existing comments are the house style; match their
  density and their tone rather than adding narration.
- **Colors and easing come from `src/globals.css`** (`@theme` tokens: forest,
  moss, blaze, clay, sand, paper, ink). No raw hex in components.
- **Tests are Vitest over pure logic only** — geometry, traversal, scoring,
  cropping, GPX, aggregation. No component or E2E tests. Test files sit beside
  what they test.
- **Commit messages are a sentence saying what changed, in the imperative,
  without a prefix** — "Say what the clear button clears", "Move the settings off
  the panel and onto the map". Read `git log` before writing one.

## Before you commit

The pre-commit hook in `.githooks/` runs exactly what CI runs — eslint, prettier
`--check`, `tsc --noEmit`, vitest, and a full build (which validates the graph).
It is enabled by `pnpm install`. Running `pnpm lint`, `pnpm typecheck`, and
`pnpm test` as you go saves the round trip.
