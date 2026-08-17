# BTR CMA Workbench

A tool for building Build-to-Rent competitor market analyses. It maintains a
searchable library of BTR comparables, imports market data directly from CoStar
exports, and (next milestone) builds weighted rent benchmarks for a subject
property.

Built with Vite + React + TypeScript + Tailwind — the same stack Lovable uses,
so it drops into a Lovable project cleanly.

## What's in v1

- **Homepage** — overview, live library stats, and workflow entry points.
- **Comp Database** — search, filter (type / bedrooms / state), sort, add / edit /
  delete properties, and export the current view to CSV. Pre-loaded with 30
  properties (138 floorplans) parsed from your existing spreadsheets.
- **CoStar import** — drop a CoStar multifamily `.xlsx` export and each property
  becomes a comp, with floorplans built from the per-bedroom asking rents.
- Data is saved to the browser (localStorage) for now. Swapping in a shared
  database (Supabase) is the recommended next step once it's on Lovable.

## Run locally (optional)

You don't need to run this locally — Lovable builds it for you. But if you want to:

```bash
npm install
npm run dev
```

Then open the printed URL.

## Getting this into GitHub

You have two options. **Option A (web upload)** is easiest and needs no tools.

### Option A — Upload through GitHub's website

1. On GitHub, create a new **empty** repository (no README, no .gitignore).
2. On the new repo's page, click **uploading an existing file**.
3. Drag in everything from this folder **except** the `node_modules` folder
   (there shouldn't be one yet). Include the `src` folder, `package.json`,
   `index.html`, and all config files.
4. Click **Commit changes**.

### Option B — Push with Git

```bash
git init
git add .
git commit -m "Initial commit: BTR CMA Workbench v1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Connecting to Lovable

1. In Lovable: **Settings → Connectors → GitHub**, and authorize.
2. Install the Lovable GitHub App, then link this repository to your project.
3. Lovable sets up two-way sync on the `main` branch: your edits in Lovable push
   to GitHub, and pushes to GitHub (including anything built here) pull back in.

Do **not** rename, move, or delete the connected repository afterward — that
permanently breaks Lovable's sync.

## Project structure

```
src/
  App.tsx                  App shell + top nav + view switching
  types.ts                 Property / Floorplan types
  data/seed.ts             Seed library (your parsed spreadsheets)
  lib/
    store.ts               localStorage-backed data store
    costar.ts              CoStar .xlsx parser
    format.ts              formatting + style helpers
  components/
    Home.tsx               Homepage
    CompDatabase.tsx       Searchable database view
    PropertyCard.tsx       Expandable property row
    EditModal.tsx          Add / edit property form
    CostarImport.tsx       CoStar drag-and-drop import
```

## Notes on the data

- The seed library was parsed automatically from messy spreadsheet text, so a
  few floorplans are worth spot-checking. One source cell had a `4,2120 sqft`
  typo — it's flagged with a ⚑ rather than silently changed.
- CoStar reports rent and unit counts by bedroom but only a **building-level**
  average square footage, so $/SF on imported comps uses that average (also
  flagged). You can refine any floorplan by editing the property.

## Next milestone: the CMA Builder

The "Build a CMA" card on the homepage is the planned next feature: pick a
subject property, pull comps from this database, weight them by bedroom bucket,
and generate a weighted rent + $/SF benchmark, a map, and an exportable report —
matching the Sonoma Trails CMA workflow.
