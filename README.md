# NMCA — NMIMS MPSTME Classroom Availability

## Start

1. Install Node.js 18 or newer.
2. In this folder, run `npm start`.
3. Open `http://localhost:3000`. The floor map and live status are public. Select **Admin sign in** to create the first (super admin) account.

The app stores users, floor definitions, timetable data, and bookings in `data/store.json`; uploaded floor images are stored in `uploads/`. Those files remain on the server when the browser reloads. Runtime data, local map PDFs, and timetable source files are excluded from this public repository.

## Floor setup

Sign in as super admin, open **Admin panel → Floor plans**, add a floor, upload a clear PNG/JPG/WebP floor image, select it, and use **Draw room outline** to click around each classroom. Label each outline with the same room code used in timetable cells, such as `CR 501` or `CL 506`. Room boundaries must be traced manually; the app does not infer exact room polygons from a PDF automatically. A local `MAP.pdf` can be placed in the project root for the PDF reference link, but it is intentionally not included in this repository.

## Timetables

Upload the weekly grid `.txt` files from **Branch timetables**. The importer reads weekday table rows and time ranges and only marks explicit `CR`, `CL`, `HL`, or `CLI` room codes as occupied. Unassigned labs and cells without a room code are not guessed. Uploading a timetable replaces that branch's prior schedule. Admin accounts are limited to their assigned branch.

## Access from other devices

The app has no database. It writes changes to local JSON and uploaded image files on the server, then public pages refresh from the same server every 10 seconds. Data is shared only while this Node server runs on a computer that the other devices can reach over the network. `localhost` is only this computer; worldwide access requires hosting the server on an internet reachable machine. The project binds to all network interfaces, so deploy it only on a trusted network and use HTTPS/access controls before public hosting.
