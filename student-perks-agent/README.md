# Student Perks Agent

A three-hour hackathon MVP for discovering real student discounts and free offers with a browser agent. The current skeleton includes the student profile UI and an API seam for live discovery; it intentionally returns no fake offers yet.

## Requirements

- Node.js 20+
- npm

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. The API runs on http://localhost:8787.

Useful checks:

```bash
curl http://localhost:8787/api/health
npm run build
```

## Structure

```text
src/                 React frontend and profile form
server/index.js      Express API entry point
server/agent/        Browser-agent orchestration seam
server/offers/       Offer model and persistence seam
```

## Current scope

The form sends a validated student profile to `POST /api/offers/discover`. The backend runs Webcmd's doctor, named profile, named session, site-memory context, and `browser run` lifecycle, then returns up to five live-web findings with source URLs and evidence fields. Identity verification, payment, account creation, and final submission are intentionally human-controlled and are not implemented.

## Next implementation

Improve source ranking and evidence extraction based on the hackathon demo's target categories. Keep every result tied to the live official/source page and retain `needs_verification` or `insufficient_evidence` when the page does not establish eligibility.
