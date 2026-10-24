# Postmark Trail — PPC Finder (Odisha sample)

A static, mobile-first finder for Permanent Pictorial Cancellations. Maintained for RDS Stamp Collection. Not affiliated with India Post.

## Published directory

The included `ppc-records.csv`, `ppc-records.json`, and `data.js` contain the same 16 Odisha records and coordinates supplied by the project owner. All `sourceUrl` values are empty. **The site has no research-source or third-party directory links.** The only outbound web links are optional Google Maps **Directions** links when a visitor selects an office; these are navigation actions, not research citations.

No coordinates or present-day operational status were independently verified in this update. The `Working` values reflect the supplied catalogue and should not be treated as live counter availability.

## Deploy to GitHub Pages

Upload the contents of this folder directly to the repository root. In repository Settings → Pages, select `Deploy from a branch`, `main`, `/(root)`. HTTPS is required for browser geolocation; otherwise use the manual post-office selector.

Core files: `index.html`, `styles.css`, `app.js`, `data.js`.

## Update the public directory

Edit `ppc-records.csv`, then update both `ppc-records.json` and `data.js` from that CSV, or directly edit `data.js` to update the array assigned to `window.PPC_STARTER_DATA`. **The live site reads `data.js`.** Merely uploading a new CSV or JSON file does not update the public catalogue.

The 12 fields are:
`id,title,introduced,postOffice,district,state,pin,recordStatus,image_url,latitude,longitude,sourceUrl`

`introduced` uses `YYYY-MM-DD`. PIN codes remain six-character strings. Numeric latitude/longitude represent the issuing post office. Keep `sourceUrl` empty if you do not want to store reference links. The app never displays source URLs, even if an imported record includes one.

## Import for personal testing

Open **Manage local catalogue** and select a CSV or JSON file with the 12-column schema. This changes records **only in that visitor’s browser**, not for all visitors. It supports up to 2,500 records. Use **Restore site directory** to reset a personal import.

## Limitations

- Distances are straight-line calculations (not road distances).
- The app does not use Google Maps API or a paid API key; Directions opens a user-selected Maps navigation URL.
- Search results are grouped by issuing post office, so the three Cuttack GPO cancellations appear together.
- There is no live verification of whether PPC devices are currently working.
- Browser location is kept in page memory; favourites and personal imports are stored locally in the browser.
