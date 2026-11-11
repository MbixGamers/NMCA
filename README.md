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

## Deployment

For Vercel, the app stores shared data in Firebase Realtime Database. The default local mode still stores state in `data/store.json` and uploaded maps in `uploads/`.

GitHub Pages cannot host this app's Node.js API or Firebase Admin SDK. If Pages displays this repository's README, it is serving the repository source rather than the app. Deploy the repository root on Vercel to serve the `public/` homepage together with the `/api` functions.

Follow the full [Vercel and Firebase deployment guide](DEPLOYMENT.md). On the Firebase Spark plan, this project uses Realtime Database only; it does not use Firebase Storage. Floor images are uploaded in small chunks into Realtime Database, so they work within Vercel's function request limits.

The first deployment has an empty Firebase state unless you migrate the current local data. To keep existing floors, room outlines, schedules, admins, and bookings, run `npm run migrate:firebase` from this folder before switching the deployed site to Firebase. The migration reads the local `data/store.json` and `uploads/` folder and writes them to Realtime Database.

Realtime Database's free quota is finite. The public status view refreshes periodically, so a large number of continuously open tabs can consume the daily read quota. Monitor usage in Firebase Console. See Firebase's current [Realtime Database free quota](https://firebase.google.com/docs/database/usage/billing).
