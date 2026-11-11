const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const ROOT=__dirname, DATA=path.join(ROOT,'data','store.json'), UP=path.join(ROOT,'uploads');
for(const d of [path.dirname(DATA),UP])fs.mkdirSync(d,{recursive:true});
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
let store;try{store=JSON.parse(fs.readFileSync(DATA,'utf8'))}catch{store={users:[],floors:[],bookings:[],timetables:[],mapFiles:[]}};const sessions=new Map();
const save=()=>fs.writeFileSync(DATA,JSON.stringify(store,null,2));
const send=(res,status,obj,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(obj))};
function body(req,limit=22e6){return new Promise((resolve,reject)=>{let a=[],n=0;req.on('data',c=>{n+=c.length;if(n>limit){reject(Error('Request too large'));req.destroy()}else a.push(c)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
const id=()=>crypto.randomUUID();const safe=s=>path.basename(String(s||'upload')).replace(/[^\w. -]/g,'_').slice(0,120);
function user(req){const sid=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4);return store.users.find(x=>x.id===sessions.get(sid))||null}
const clean=u=>({id:u.id,name:u.name,username:u.username,role:u.role,branch:u.branch});
function normRoom(s){return String(s||'').toUpperCase().replace(/\s+/g,' ').replace(/\b(CLI|CR|CL|HL|LAB)\s*-?\s*(\d{1,4})\b/g,'$1 $2').trim()}
function parseTime(t){let m=t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);if(!m)return null;let h=+m[1],mi=+(m[2]||0),ap=(m[3]||'').toUpperCase();if(ap){if(h===12)h=0;if(ap==='PM')h+=12}return h*60+mi}
function clock(n){return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function parseTimetable(raw,branch,filename){
 let slots=[], lines=raw.replace(/^\uFEFF/,'').split(/\r?\n/),active=null,headers=[];
 // Grid format used in the supplied files: first column is a time range, remaining columns are weekdays.
 for(const line0 of lines){const line=line0.trim();if(!line.startsWith('|'))continue;let cells=line.split('|').slice(1,-1).map(x=>x.trim());if(cells.length<2||/^[-: ]+$/.test(cells.join('')))continue;
  if(/^(time|hours?)$/i.test(cells[0])){headers=cells.slice(1).map(c=>days.find(d=>d.toLowerCase().startsWith(c.toLowerCase()))||c);active={headers,continued:[]};continue}
  if(!active||cells[0]==='') {if(active&&cells[0]===''){active.continued=cells.slice(1);continue}continue}
  let tm=cells[0].match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);if(!tm)continue;
  let a=parseTime(tm[1].replace(/\s/g,'')),b=parseTime(tm[2].replace(/\s/g,''));if(a==null||b==null)continue;if(b<=a)b+=720;
  cells.slice(1).forEach((cell,i)=>{let text=[cell,active.continued?.[i]].filter(Boolean).join(' ').trim();if(!text||/^(BREAK|LIBRARY HOUR|RESERVED FOR|$)/i.test(text))return;
   // Only explicit CR/CL/HL room tags can establish room occupancy. Roomless labs remain unassigned.
   const matches=[...text.matchAll(/\b(CR|CL|HL|CLI)\s*-?\s*(\d{1,4})\b/gi)];if(!matches.length)return;
   const room=normRoom(matches[0][0]),subject=text.replace(/\[[^\]]*\]/g,'').replace(/\b(CR|CL|HL|CLI)\s*-?\s*\d{1,4}\b/ig,'').replace(/\s+/g,' ').trim();
   slots.push({day:active.headers[i]||days[i],start:clock(a),end:clock(b),room,subject:subject||'Class',branch});
  });active.continued=[];
 }
 // Also accept simple rows: day, start, end, room, subject[, branch].
 if(!slots.length)for(const l of lines){let c=l.split(/[\t,;|]+/).map(x=>x.trim());if(c.length<5||/^day$/i.test(c[0]))continue;if(!days.some(d=>d.toLowerCase()===c[0].toLowerCase()))continue;let a=parseTime(c[1]),b=parseTime(c[2]);if(a==null||b==null)continue;slots.push({day:c[0],start:clock(a),end:clock(b),room:normRoom(c[3]),subject:c[4],branch:c[5]||branch})}
 return {id:id(),branch,filename,uploadedAt:new Date().toISOString(),raw,slots};
}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=u.pathname;
 if(p.startsWith('/uploads/')){const f=path.join(UP,path.basename(decodeURIComponent(p.slice(9))));return fs.createReadStream(f).on('error',()=>{res.writeHead(404);res.end()}).pipe(res)}
 if(p==='/MAP.pdf'){const mapPdf=path.join(ROOT,'MAP.pdf');if(!fs.existsSync(mapPdf)){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Campus PDF is not installed. Upload a floor image from the admin panel.')}res.writeHead(200,{'Content-Type':'application/pdf'});return fs.createReadStream(mapPdf).pipe(res)}
 if(p==='/api/status')return send(res,200,{setup:store.users.length===0,authenticated:!!user(req),user:user(req)&&clean(user(req))});
 if(p==='/api/public'&&req.method==='GET')return send(res,200,{floors:store.floors,bookings:store.bookings.map(({date,start,end,room,status})=>({date,start,end,room,status})),timetables:store.timetables.map(({branch,slots})=>({branch,slots})),mapFiles:store.mapFiles,me:null});
 if(p==='/api/setup'&&req.method==='POST'){if(store.users.length)return send(res,409,{error:'Setup is already complete'});let b=JSON.parse(await body(req));if(!b.name||!b.username||!b.password||b.password.length<10)return send(res,400,{error:'Name, username and a password of at least 10 characters are required'});let x={id:id(),name:b.name,username:b.username.toLowerCase(),role:'superadmin',salt:crypto.randomBytes(16).toString('hex')};x.hash=crypto.scryptSync(b.password,x.salt,64).toString('hex');store.users.push(x);save();let sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,x.id);return send(res,200,{user:clean(x)},{'Set-Cookie':`sid=${sid}; HttpOnly; SameSite=Lax; Path=/`})}
 if(p==='/api/login'&&req.method==='POST'){let b=JSON.parse(await body(req)),x=store.users.find(y=>y.username===String(b.username||'').toLowerCase());if(!x||crypto.scryptSync(String(b.password||''),x.salt,64).toString('hex')!==x.hash)return send(res,401,{error:'Invalid username or password'});let sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,x.id);return send(res,200,{user:clean(x)},{'Set-Cookie':`sid=${sid}; HttpOnly; SameSite=Lax; Path=/`})}
 if(p==='/api/logout'&&req.method==='POST'){let sid=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4);sessions.delete(sid);return send(res,200,{ok:true},{'Set-Cookie':'sid=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax'})}
 if(p.startsWith('/api/')){let me=user(req);if(!me)return send(res,401,{error:'Sign in to continue'});
  if(p==='/api/state'&&req.method==='GET')return send(res,200,{floors:store.floors,bookings:store.bookings,timetables:store.timetables.map(({raw,...x})=>x),mapFiles:store.mapFiles,users:me.role==='superadmin'?store.users.map(clean):undefined,me:clean(me)});
  if(p==='/api/floors'&&req.method==='PUT'){if(me.role!=='superadmin')return send(res,403,{error:'Super admin access required'});store.floors=JSON.parse(await body(req)).floors||[];save();return send(res,200,{floors:store.floors})}
  if(p==='/api/users'&&req.method==='POST'){if(me.role!=='superadmin')return send(res,403,{error:'Super admin access required'});let b=JSON.parse(await body(req));if(!b.username||!b.password||b.password.length<10)return send(res,400,{error:'Username and password of at least 10 characters are required'});if(store.users.some(x=>x.username===b.username.toLowerCase()))return send(res,409,{error:'Username already exists'});let x={id:id(),name:b.name||b.username,username:b.username.toLowerCase(),role:'admin',branch:b.branch||'Unassigned',salt:crypto.randomBytes(16).toString('hex')};x.hash=crypto.scryptSync(b.password,x.salt,64).toString('hex');store.users.push(x);save();return send(res,201,{user:clean(x)})}
  if(p==='/api/bookings'&&req.method==='POST'){let b=JSON.parse(await body(req));if(!b.date||!b.start||!b.end||!b.room||!b.purpose)return send(res,400,{error:'Complete all booking fields'});if(b.end<=b.start)return send(res,400,{error:'End time must be after start time'});let clash=store.bookings.find(x=>x.date===b.date&&normRoom(x.room)===normRoom(b.room)&&x.status!=='cancelled'&&x.start<b.end&&b.start<x.end);if(clash)return send(res,409,{error:'This classroom is already booked during that time'});let item={...b,room:normRoom(b.room),id:id(),createdBy:me.name,createdAt:new Date().toISOString(),status:'confirmed'};store.bookings.push(item);save();return send(res,201,{booking:item})}
  if(p.startsWith('/api/bookings/')&&req.method==='DELETE'){let x=store.bookings.find(x=>x.id===p.split('/').pop());if(!x)return send(res,404,{error:'Booking not found'});if(me.role!=='superadmin'&&x.createdBy!==me.name)return send(res,403,{error:'You can only cancel your own booking'});store.bookings=store.bookings.filter(y=>y.id!==x.id);save();return send(res,200,{ok:true})}
  if(p==='/api/timetables'&&req.method==='POST'){let b=JSON.parse(await body(req)),branch=String(b.branch||me.branch||'').trim();if(!branch)return send(res,400,{error:'Enter a branch name before uploading'});if(me.role!=='superadmin'&&me.branch&&branch.toLowerCase()!==me.branch.trim().toLowerCase())return send(res,403,{error:'You can only upload your assigned branch timetable'});let raw=String(b.text||'');if(!raw.trim())return send(res,400,{error:'The selected text file is empty or could not be read'});let item=parseTimetable(raw,branch,b.filename||'schedule.txt');if(!item.slots.length)return send(res,422,{error:'No room-assigned classes were found. Use the weekly timetable grid and include room codes such as CR 103 or CL 506 in class cells.'});store.timetables=store.timetables.filter(x=>x.branch.toLowerCase()!==branch.toLowerCase());store.timetables.push(item);save();return send(res,201,{timetable:{...item,raw:undefined},message:`Imported ${item.slots.length} room-assigned class slots.`})}
  if(p.startsWith('/api/timetables/')&&req.method==='GET'){let x=store.timetables.find(x=>x.id===p.split('/').pop());return x?send(res,200,{...x}):send(res,404,{error:'Timetable not found'})}
  if(p==='/api/map'&&req.method==='POST'){if(me.role!=='superadmin')return send(res,403,{error:'Super admin access required'});let b=JSON.parse(await body(req)),name=safe(b.filename),buf=Buffer.from(b.data,'base64'),ext=path.extname(name).toLowerCase();if(buf.length>16e6)return send(res,413,{error:'File exceeds 16 MB'});if(!['.pdf','.png','.jpg','.jpeg','.webp'].includes(ext))return send(res,400,{error:'Upload a PDF or floor image'});let file=`${id()}${ext}`;fs.writeFileSync(path.join(UP,file),buf);let item={id:id(),name,url:'/uploads/'+file,uploadedAt:new Date().toISOString()};store.mapFiles.push(item);save();return send(res,201,{file:item})}
  return send(res,404,{error:'Not found'});
 }
 let file=p==='/'?path.join(ROOT,'public','index.html'):path.join(ROOT,'public',path.normalize(p).replace(/^[/\\]+/,''));if(!file.startsWith(path.join(ROOT,'public')))return send(res,404,{});fs.readFile(file,(e,d)=>{if(e){res.writeHead(404);res.end('Not found')}else{res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'});res.end(d)}})
 }catch(e){send(res,500,{error:e.message||'Server error'})}});
const port=Number(process.env.PORT)||3000;server.listen(port,'0.0.0.0',()=>console.log(`Classroom Booking running at http://localhost:${port}`));
