# Thesis Catalog — reusable components

Drop these into `packages/ui/src/` (paths match exactly, so it's a straight copy):

```
src/types/thesis.ts
src/components/thesis/StatusBadge.tsx
src/components/thesis/FeaturedThesisCard.tsx
src/components/thesis/SubmissionHealthCard.tsx
src/components/thesis/ThesisListView.tsx
src/pages/ThesisCatalogPage.tsx
```

Add the exports in `src/index.ts` to your existing barrel file (or copy the one included here if you don't have one yet).

## Requirements

1. **`lucide-react`** — used for icons. Install in `packages/ui` if not already there:
   ```
   pnpm add lucide-react   # or npm/yarn, matching your setup
   ```
2. **Tailwind content globs** — make sure both `apps/web` and `apps/desktop` Tailwind configs include `packages/ui` in `content`, e.g.:
   ```js
   content: [
     "./src/**/*.{ts,tsx}",
     "../../packages/ui/src/**/*.{ts,tsx}",
   ],
   ```
3. **Fonts** — the design uses a serif display face (`font-serif`) for headings and the default sans for body/data. If you want the exact look from the mockup, load a serif like **Source Serif 4** or **Lora** and map it to `font-serif` in `tailwind.config`:
   ```js
   theme: {
     extend: {
       fontFamily: {
         serif: ["Source Serif 4", "ui-serif", "Georgia"],
       },
     },
   },
   ```
   If you skip this, it'll just fall back to the system serif — still fine, just less distinctive.

## Design direction

Moved away from the flat white/yellow wireframe toward an "academic ledger" feel that fits a thesis-review product: deep forest green (`#16342B`) instead of the brighter sidebar green, a muted brass/gold accent (`#B8934C`) instead of pure yellow for pending states, and a serif display face for titles to nod at the subject matter (theses, manuscripts). The health card's progress indicator is a ruled line with tick marks at 0/25/50/75/100 rather than a generic rounded progress bar — meant to read like a ledger scale.

## Usage

```tsx
import { ThesisCatalogPage } from "@monteai/ui";

<ThesisCatalogPage
  featuredThesis={featuredThesis}
  theses={theses}
  healthStats={{ approvalRate: 94, yearLabel: "2023" }}
  counts={{ active: 24, archived: 158 }}
  onViewDetails={(id) => router.push(`/theses/${id}`)}
  onSelectThesis={(id) => router.push(`/theses/${id}`)}
  onThesisAction={(id) => openActionMenu(id)}
  onFilterClick={() => setFilterOpen(true)}
/>
```

All data and callbacks are passed in as props — no fetching or routing happens inside `packages/ui`, so it stays framework-agnostic between `apps/web` (likely Next.js) and `apps/desktop` (likely Electron/Tauri + React).

Components (`StatusBadge`, `FeaturedThesisCard`, `SubmissionHealthCard`, `ThesisListView`) are also exported individually if you want to compose your own layout instead of using the full page.