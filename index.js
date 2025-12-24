const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const USERS_FILE = path.join(__dirname, 'users.json');
const MSGS_FILE = path.join(__dirname, 'messages.json');
const ADMIN_NAME = "CooperChen";
const ADMIN_PASS = "11036666";

let onlineUsers = {}; 

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([{ name: ADMIN_NAME, pass: ADMIN_PASS, role: "admin", rooms: ["大廳", "秘密基地"] }], null, 2));
if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, JSON.stringify([]));

app.use(express.json({ limit: '100mb' }));

// --- 上帝控制台 (駭客風) ---
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('ACCESS DENIED');
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    let userRows = users.map(user => `<tr><td>[${user.name}]</td><td>${user.rooms ? user.rooms.join(',') : '大廳'}</td><td>${onlineUsers[user.name] ? '<b style="color:#0f0;">ONLINE >> '+onlineUsers[user.name].ip+'</b>' : '<span style="color:#555;">OFFLINE</span>'}</td></tr>`).join('');
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#000;color:#0f0;font-family:"Courier New",monospace;padding:20px;} .box{border:1px solid #0f0;padding:20px;margin-bottom:20px;} input{background:#000;border:1px solid #0f0;color:#0f0;padding:10px;margin:5px;width:80%;} button{background:#0f0;color:#000;border:none;padding:10px;font-weight:bold;cursor:pointer;width:100%;} table{width:100%;border-collapse:collapse;} th,td{padding:8px;border:1px solid #0f0;text-align:left;} textarea{width:100%;height:150px;background:#000;color:#0f0;border:1px solid #0f0;}</style></head><body>
        <h2>GOD_MODE_CONSOLE v7.0</h2>
        <div class="box"><h3>USER_STATUS</h3><table>${userRows}</table></div>
        <div class="box"><h3>ADD_USER</h3>帳號:<input id="nu">密碼:<input id="np">頻道:<input id="nr" value="大廳"><button onclick="addUser()">EXECUTE</button></div>
        <div class="box"><h3>GITHUB_SYNC_CODE</h3><textarea id="syncBox" readonly>${JSON.stringify(users, null, 2)}</textarea><button onclick="copyCode()">COPY_TO_CLIPBOARD</button></div>
        <button onclick="location.href='/'" style="background:#333;color:#fff;">EXIT_CONSOLE</button>
        <script>async function addUser(){const u=document.getElementById('nu').value,p=document.getElementById('np').value,r=document.getElementById('nr').value.split(',');if(!u||!p)return;await fetch('/api/add-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u,p,r,adminU:'${ADMIN_NAME}',adminP:'${ADMIN_PASS}'})});location.reload();}function copyCode(){const t=document.getElementById('syncBox');t.select();document.execCommand('copy');alert('SYNC_CODE_COPIED');}</script></body></html>`);
});

app.post('/api/add-user', (req, res) => {
    const { u, p, r, adminU, adminP } = req.body;
    if (adminU !== ADMIN_NAME || adminP !== ADMIN_PASS) return res.sendStatus(403);
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    users.push({ name: u, pass: p, role: "user", rooms: r || ["大廳"] });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.sendStatus(200);
});

// --- 主介面 ---
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>
    :root { --green: #00ff00; --bg: #000; --gray: #222; }
    body { margin:0; background: var(--bg); color: var(--green); font-family: 'Courier New', Courier, monospace; display:flex; flex-direction:column; height:100vh; }
    
    /* 啟動動畫 */
    #loader { position:fixed; inset:0; background:#000; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:9999; transition: opacity 0.5s; }
    .scanline { width:100%; height:2px; background:rgba(0,255,0,0.1); position:absolute; animation: scan 2s linear infinite; }
    @keyframes scan { from { top:0; } to { top:100%; } }

    header { border-bottom: 1px solid var(--green); padding:10px; display:flex; gap:10px; overflow-x:auto; }
    #chat-box { flex:1; overflow-y:auto; padding:15px; border-left: 1px solid var(--green); border-right: 1px solid var(--green); margin: 0 10px; }
    .msg { margin-bottom: 15px; border-left: 2px solid #111; padding-left: 10px; }
    .msg-me { border-left: 2px solid var(--green); color: #fff; }
    .msg small { color: var(--green); font-size: 10px; opacity: 0.7; }
    
    .input-bar { border: 1px solid var(--green); margin: 10px; display:flex; align-items:center; padding:5px; }
    #txt { flex:1; background:none; border:none; color:var(--green); padding:10px; font-family:inherit; outline:none; }
    .btn { padding:10px 20px; cursor:pointer; background: var(--green); color:#000; font-weight:bold; }
    
    #room-list button { background:none; border:1px solid var(--green); color:var(--green); cursor:pointer; padding:5px 10px; }
    #room-list button.active { background: var(--green); color:#000; }

    #auth-box { position:fixed; inset:0; background:#000; z-index:1000; display:flex; align-items:center; justify-content:center; }
    .auth-card { border:1px solid var(--green); padding:30px; width:280px; text-align:center; }
    .auth-card input { width:100%; padding:10px; margin-bottom:10px; background:#000; border:1px solid var(--green); color:var(--green); box-sizing:border-box; outline:none; }
    
    .img-preview { max-width:200px; border:1px solid var(--green); margin-top:5px; display:block; filter: grayscale(1) contrast(1.2); }
    .img-preview:hover { filter: none; }
    </style></head>
    <body>
        <div id="loader"><div class="scanline"></div><h2>SYSTEM_LOADING...</h2></div>
        
        <div id="auth-box">
            <div class="auth-card">
                <h3>ACCESS_POINT_6.0</h3>
                <input id="un" placeholder="USER_ID">
                <input id="pw" type="password" placeholder="PASS_CODE">
                <button onclick="doL()" class="btn" style="width:100%">LOGIN</button>
            </div>
        </div>

        <header id="room-list"></header>
        <div id="chat-box"></div>
        <div class="input-bar">
            <label style="padding:0 10px; cursor:pointer;">[FILE]<input type="file" id="fi" hidden onchange="upFile(this)"></label>
            <span style="color:var(--green)"> > </span>
            <input id="txt" placeholder="ENTER_MESSAGE..." autocomplete="off" onkeypress="if(event.key==='Enter')send()">
            <div class="btn" onclick="send()">SEND</div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket=io(); let me=null, curRoom="大廳";
            socket.on('connect', () => { setTimeout(()=>{ document.getElementById('loader').style.opacity='0'; setTimeout(()=>document.getElementById('loader').style.display='none',500); },800); });

            function doL(){ socket.emit('login',{u:document.getElementById('un').value, p:document.getElementById('pw').value}); }
            socket.on('auth_ok', d=>{ me=d; document.getElementById('auth-box').style.display='none'; updateRooms(d.rooms); });

            function updateRooms(rooms) {
                const rl = document.getElementById('room-list');
                rl.innerHTML = rooms.map(r => '<button class="'+(r===curRoom?'active':'')+'" onclick="joinR(\\''+r+'\\')">'+r+'</button>').join('') + 
                                '<a href="/master-panel?u=CooperChen&p=11036666" style="color:red;font-size:10px;margin-left:auto;">[GOD_MODE]</a>';
            }

            function joinR(r){ if(r===curRoom) return; curRoom=r; socket.emit('join', r); document.getElementById('chat-box').innerHTML=''; updateRooms(me.rooms); }

            function upFile(el){
                const f=el.files[0]; if(!f)return;
                const r=new FileReader(); r.onload=e=>{ socket.emit('msg',{c:'', f:e.target.result, fn:f.name, rm:curRoom}); }; r.readAsDataURL(f); el.value='';
            }

            function send(){ const t=document.getElementById('txt'); if(t.value.trim()){ socket.emit('msg',{c:t.value, rm:curRoom}); t.value=''; } }
            
            socket.on('history', logs => { document.getElementById('chat-box').innerHTML=''; logs.filter(m=>m.rm===curRoom).forEach(m=>addMsg(m)); });
            socket.on('new_msg', m => { if(m.rm === curRoom) addMsg(m); });

            function addMsg(m) {
                const b=document.getElementById('chat-box'), d=document.createElement('div');
                d.className='msg '+(m.s===me.name?'msg-me':'');
                let content = '> ' + m.c;
                if(m.f) {
                    if(m.f.startsWith('data:image')) content += '<img src="'+m.f+'" class="img-preview">';
                    else content += '<br>[ATTACHMENT: '+m.fn+'] <a href="'+m.f+'" download="'+m.fn+'" style="color:#fff;">DOWNLOAD</a>';
                }
                d.innerHTML = '<small>['+m.s+'] '+new Date().toLocaleTimeString()+'</small><br>'+content;
                b.appendChild(d); b.scrollTop=b.scrollHeight;
            }
        </script>
    </body></html>`);
});

// --- Socket 邏輯 ---
io.on('connection', (socket) => {
    const userIP = (socket.handshake.headers['x-forwarded-for'] || socket.handshake.address).split(',')[0];
    socket.on('login', (d) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const u = users.find(x => x.name === d.u && x.pass === d.p);
        if (u) {
            socket.u = u;
            onlineUsers[u.name] = { ip: userIP };
            socket.emit('auth_ok', { name: u.name, rooms: u.rooms || ["大廳"] });
            socket.join("大廳");
            socket.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)).slice(-100));
        }
    });
    socket.on('join', r => {
        if(!socket.u || !socket.u.rooms.includes(r)) return;
        socket.rooms.forEach(room => { if(room !== socket.id) socket.leave(room); });
        socket.join(r);
        socket.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)).slice(-100));
    });
    socket.on('msg', (p) => {
        if (!socket.u) return;
        const newMsg = { s: socket.u.name, c: p.c, f: p.f, fn: p.fn, rm: p.rm || "大廳", t: Date.now() };
        let msgs = JSON.parse(fs.readFileSync(MSGS_FILE));
        msgs.push(newMsg);
        fs.writeFileSync(MSGS_FILE, JSON.stringify(msgs.slice(-500)));
        io.to(p.rm || "大廳").emit('new_msg', newMsg);
    });
    socket.on('disconnect', () => { if(socket.u) delete onlineUsers[socket.u.name]; });
});

http.listen(PORT, '0.0.0.0', () => console.log('TERMINAL_READY'));
