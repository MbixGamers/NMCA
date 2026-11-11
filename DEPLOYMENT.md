# Deploy NMCA on Vercel with Firebase Realtime Database

This setup uses Vercel for the website/API and Firebase Realtime Database for shared persistent data. It does not use Firebase Storage or Vercel Blob. The Firebase Admin service-account key remains server-side in Vercel environment variables.

The app is configured for the Realtime Database URL you provided:

`https://nmca-93b70-default-rtdb.asia-southeast1.firebasedatabase.app`

## 1. Confirm the Realtime Database setup

You have already created the Realtime Database in project `nmca-93b70`. Keep it on the Spark plan. The Admin SDK server will access it using your service account. Choose locked rules; the Admin SDK bypasses client security rules, while direct public access stays blocked.

The Spark plan currently includes 1 GB of stored data, 10 GB/month of downloads, and a limit of 100 simultaneous connections. Floor images are uploaded as small chunks, and the app stores data under `/nmca/state` and `/nmca/maps`. Monitor usage in Firebase Console. See [Realtime Database billing and free usage](https://firebase.google.com/docs/database/usage/billing) and [Realtime Database limits](https://firebase.google.com/docs/database/usage/limits).

## 2. Download a service-account key

In Firebase, open **Project settings → Service accounts → Generate new private key**. Save the JSON key file privately. Do not commit it, place it in `public/`, or send it in chat.

## 3. Migrate the current local app data

Run this on the computer that has the current NMCA `data/store.json` and `uploads` folder. It copies floors and room boundaries, timetables, admin accounts, bookings, and uploaded map files to Realtime Database.

In PowerShell, from the project folder:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_BASE64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\your-service-account.json"))
$env:FIREBASE_DATABASE_URL = "https://nmca-93b70-default-rtdb.asia-southeast1.firebasedatabase.app"
npm run migrate:firebase
Remove-Item Env:FIREBASE_SERVICE_ACCOUNT_BASE64
Remove-Item Env:FIREBASE_DATABASE_URL
```

Replace the sample key path with the key file you downloaded. The migration prints how many records and map files it copied. It skips maps whose file is missing from `uploads/`.

If you want a clean install, skip migration. The first visitor can create a new super admin from **Admin sign in → First time setup**. Do not use first-time setup if you migrated an existing admin account.

## 4. Import the fresh repository into Vercel

1. In Vercel, choose **Add New → Project** and import `MbixGamers/NMCA` from the fresh GitHub repository.
2. Set **Root Directory** to the repository root.
3. Choose the **Other** framework preset and leave the build command empty. Vercel installs the Node dependency from `package.json`.
4. Deploy the `main` branch as Production. The repository includes the Vercel function configuration and static homepage output setup.

The repository has a Vercel Node function entry point and rewrites for API calls and uploaded map files.

## 5. Add Vercel environment variables

Open **Project → Settings → Environment Variables** and add these for **Production**. Add them for **Preview** too if you want preview deployments to use Firebase.

| Name | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | One-line Base64 encoding of the complete Firebase service-account JSON file |
| `FIREBASE_DATABASE_URL` | `https://nmca-93b70-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `SESSION_SECRET` | A long random secret with at least 32 random characters |

Generate the service-account value in PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\your-service-account.json"))
```

Generate `SESSION_SECRET` locally with Node.js:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy those values into Vercel. Never put them in source code, GitHub, or a `NEXT_PUBLIC_` variable. Redeploy after saving them so the serverless function receives the values.

## 6. Verify the deployed website

1. Open the Vercel URL. The home page and live map are public; admin sign-in is separate.
2. Confirm your existing floor map and room outlines appear. If you migrated, sign in with the existing super admin account. Otherwise, create the first super admin.
3. Check **Floor plans**, **Branch timetables**, **After-hours bookings**, and **Admin accounts** from the super admin panel.
4. Make an after-hours booking and confirm overlapping requests for the same room are rejected, including from another device.
5. Check Firebase **Realtime Database → Usage** and Vercel **Deployments → Functions → Logs** if anything fails.

If the API says Firebase is not configured, check the Vercel environment variables and redeploy. If access is denied, check that the key belongs to project `nmca-93b70` and the database URL matches the one above.

## Notes

- Vercel's function filesystem is temporary. Production data must be stored in Realtime Database; the app intentionally does not fall back to local JSON files on Vercel.
- Local `npm start` still stores data in `data/store.json` and uploaded maps in `uploads/`.
- Realtime Database rules can remain locked because the Admin SDK accesses the database on the server and bypasses client rules. Keep the service-account key private.
- The live status display polls periodically and calculates availability from the uploaded timetable, selected time, and saved bookings; it is not a physical occupancy sensor.
