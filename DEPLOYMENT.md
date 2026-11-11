# Deploy NMCA on Vercel with Firebase Spark

This setup uses Vercel for the website and API, and Cloud Firestore as shared persistent storage. It does **not** use Firebase Storage or Vercel Blob. Firebase service-account credentials stay in server-side environment variables and are never sent to the browser.

## 1. Create Firebase project and Firestore

1. Open [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Keep the project on the **Spark (no-cost)** plan.
3. In **Build → Firestore Database**, create a database in **Production mode**. Choose a region near your users; the database region cannot be changed later.
4. Do not enable Firebase Storage. The app stores uploaded map files as chunked Firestore documents.
5. In **Project settings → Service accounts**, choose **Generate new private key** and download the JSON file. Keep it private; do not commit it or send it to anyone.

Firestore's free quota currently includes 1 GiB stored data, 50,000 document reads/day, and 20,000 writes/day. A floor image is split into chunks so no individual Firestore document approaches the 1 MiB document limit. Firestore quota still applies to map uploads and the app's periodic status refreshes. Review [Firestore quotas](https://firebase.google.com/docs/firestore/quotas) before opening the site to many users.

## 2. Migrate existing local data (recommended)

Do this on the computer that has the current NMCA `data/store.json` and `uploads` folder. This preserves mapped floor boundaries, uploaded timetable slots, current admin accounts, and bookings.

In PowerShell, from the project folder:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_BASE64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\your-service-account.json"))
npm run migrate:firebase
Remove-Item Env:FIREBASE_SERVICE_ACCOUNT_BASE64
```

Replace the sample path with the JSON key file downloaded from Firebase. The migration prints the number of floors, schedules, bookings, and map files copied. It skips a map file if the corresponding file is missing from `uploads/`.

If you prefer a clean install, skip migration. The first visitor can then create a new super admin from **Admin sign in → First time setup**. Do not use first-time setup if you migrated an existing admin account.

## 3. Import the GitHub project into Vercel

1. In [Vercel](https://vercel.com/), choose **Add New → Project** and import `MbixGamers/NMCA`.
2. Set the **Root Directory** to the repository root.
3. Use the **Other** framework preset. Leave the build command empty; Vercel installs dependencies from `package.json`.
4. Deploy after adding the environment variables in the next step. The repository includes the Vercel function entry point and routing rules.

## 4. Configure Vercel environment variables

Open **Project → Settings → Environment Variables**. Add both values for **Production**, and for **Preview** too if you use preview deployments:

| Name | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | One-line Base64 encoding of the full service-account JSON file |
| `SESSION_SECRET` | A long random secret, at least 32 random characters |

To generate the first value in PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\your-service-account.json"))
```

Generate `SESSION_SECRET` locally with Node.js:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy each output into the matching Vercel variable. Never put either value in a source file, `public/`, GitHub, or a `NEXT_PUBLIC_` variable. After saving variables, redeploy so the function receives them.

## 5. Finish and verify deployment

1. Open the deployed URL. The main floor map is public; no login is needed to check availability.
2. Confirm the floor selector and mapped rooms appear. If you migrated, the existing setup and admin accounts should work. If not, create the first super admin.
3. From the super admin account, check **Floor plans**, **Branch timetables**, **After-hours bookings**, and **Admin accounts**.
4. Test an after-hours booking and confirm the room disappears for an overlapping request on another browser/device.
5. Check Vercel **Deployments → Functions → Logs** if an API request fails. Check Firebase **Firestore → Usage** for free-quota consumption.

If Vercel responds with “Firebase is not configured,” verify that `FIREBASE_SERVICE_ACCOUNT_BASE64` is present for the deployed environment and redeploy. If Firestore reports permission errors, verify the service account key is valid and belongs to the same Firebase project.

## Notes

- Vercel's function filesystem is temporary. The deployed app therefore requires Firebase credentials; it will not fall back to local JSON storage on Vercel.
- Local `npm start` continues to use `data/store.json` and `uploads/`.
- The Firestore service account has privileged server access. Keep its key secret and rotate it if it is exposed.
- Vercel deployments do not automatically receive ignored local files. Migrate local data before switching traffic if you need the existing floor maps and schedules.
- “Live” status is refreshed by the browser on a short interval; it is not a sensor feed. It is calculated from timetable slots, the selected time, and saved bookings.
