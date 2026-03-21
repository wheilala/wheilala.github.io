# wheilala.github.io

GitHub Pages host repository for published static projects.

## RTSC Soccer Wizard

RTSC Soccer Wizard is a coach-focused scouting and schedule viewer for Rose Tree SC teams.

## Usage

Local Soccer Wizard is intended to help coaches scout upcoming opponents by understanding recent competition, recent performance, and schedule context with lightweight automated insights.

1. Select the RTSC team of interest.
2. Upcoming games and prior results for the selected team are shown by default.
3. Drill into an opponent to get a summary of recent performance plus a breakdown of future and past schedule.
4. Schedule information is periodically synced into the published site.
5. Additional coach-centric features can continue to build on this workflow over time.

## Source Workflow

The source application lives in:

- `C:\Users\wayne\Documents\LocalSoccerWizard`

Export the latest static site from the app repo with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-github-pages-site.ps1
```
