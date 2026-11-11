const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function main() {
  const credentialValue = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
    : process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!credentialValue) throw Error('Set FIREBASE_SERVICE_ACCOUNT_BASE64 before running this migration.');
  const account = JSON.parse(credentialValue);
  const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://nmca-93b70-default-rtdb.asia-southeast1.firebasedatabase.app';
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(account), projectId: account.project_id, databaseURL });
  const database = admin.database();
  const root = path.resolve(__dirname, '..');
  const statePath = path.join(root, 'data', 'store.json');
  if (!fs.existsSync(statePath)) throw Error('data/store.json was not found. Run this on the computer holding your current local app data.');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  for (const timetable of state.timetables || []) delete timetable.raw;
  await database.ref('nmca/state').set(state);

  let migrated = 0;
  for (const item of state.mapFiles || []) {
    const filename = path.basename(new URL(item.url, 'https://local.invalid').pathname);
    const localPath = path.join(root, 'uploads', filename);
    if (!fs.existsSync(localPath)) {
      console.warn('Map file not found locally; skipped:', filename);
      continue;
    }
    const bytes = fs.readFileSync(localPath);
    const ext = path.extname(filename).toLowerCase();
    const type = ({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf'})[ext] || 'application/octet-stream';
    const id = filename.split('.')[0];
    const mapRef = database.ref('nmca/maps/' + id);
    const chunkSize = 400000;
    await mapRef.child('meta').set({ name: item.name, type, size: bytes.length, parts: Math.ceil(bytes.length / chunkSize), createdAt: item.uploadedAt || new Date().toISOString() });
    for (let offset = 0, n = 0; offset < bytes.length; offset += chunkSize, n++) {
      const key = String(n).padStart(4, '0');
      const data = bytes.subarray(offset, offset + chunkSize).toString('base64');
      await mapRef.child('chunks/' + key).set({ n, data, type });
    }
    migrated++;
  }
  console.log('Migrated ' + (state.floors?.length || 0) + ' floors, ' + (state.timetables?.length || 0) + ' timetables, ' + (state.bookings?.length || 0) + ' bookings, and ' + migrated + ' map files.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
