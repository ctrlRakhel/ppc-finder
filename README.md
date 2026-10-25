# PPC Compass — India's Permanent Pictorial Cancellation Finder

A static, mobile-first finder for Permanent Pictorial Cancellations. Maintained for RDS Stamp Collection. Not affiliated with India Post.

## Deploy to GitHub Pages

Upload the contents of this folder directly to the repository root. In repository Settings → Pages, select `Deploy from a branch`, `main`, `/(root)`. HTTPS is required for browser geolocation; otherwise use the manual post-office selector.

Core files: `index.html`, `styles.css`, `app.js`, `data.js`.

## Architecture

PPC Compass is a mobile-first application for locating
Permanent Pictorial Cancellations at Indian post offices.

Frontend:
GitHub Pages — HTML, CSS and JavaScript

Backend:
Cloudflare Workers

Database:
Cloudflare D1

Data source:
Private PPC directory

The browser sends selected or device-derived coordinates
to the backend API.

The API returns nearby PPC records and calculated
straight-line distances.

The complete directory is not downloaded by the frontend.

## Limitations

- Distances are straight-line calculations (not road distances).
- The app does not use Google Maps API or a paid API key; Directions opens a user-selected Maps navigation URL.
- Search results are grouped by issuing post office, so the three Cuttack GPO cancellations appear together.
- There is no live verification of whether PPC devices are currently working.
- Browser location is kept in page memory; favourites and personal imports are stored locally in the browser.
