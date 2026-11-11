# Wally Atkins Application Suite (PWA)

A standalone, role-gated Progressive Web App container for the **Wally Atkins** application ecosystem.

## Features
- **Last-Used Module Persistence**: Remembers your active module via `localStorage` and automatically opens straight into it.
- **Module Switcher**: Sleek header toggle (`[Module Icon + Name ▾]`) allowing seamless navigation across available applications.
- **Role-Based Access Control**: Gatekeeps modules based on authenticated WallyAuth OIDC user roles (`football-player`, `mud-player`, `tasks-user`, `admin`).
- **In-PWA Lightweight Interfaces**:
  - **NFL Pick'em**: Weekly matchup slider, pick wizard auto-launch, text-only matrix view, and survivor pool.
  - **WallyMUD**: In-app retro ANSI web terminal with mobile directional keypad and quick actions.
  - **WallyTasks**: Lightweight mobile project and task tracker.
- **Granular Opt-In Notification Matrix**:
  - Strict default **opt-out** policy (no spam).
  - Explicit per-app control for Kickoff Reminders, SMS Alerts, MUD Tells/Combat Alerts, and Task Deadlines.
  - Automatic browser timezone detection (`Intl.DateTimeFormat().resolvedOptions().timeZone`) with manual override.

## Tech Stack
- **Framework**: React 19 + TypeScript + Vite 6
- **PWA**: `vite-plugin-pwa` + Workbox
- **Icons**: `lucide-react`
- **Identity & Auth**: WallyAuth OIDC cross-domain session trust

## Build & Deployment
```bash
# Development
npm run dev

# Production Build
npm run build

# Deploy to Bluehost
./scripts/deploy.sh
```
