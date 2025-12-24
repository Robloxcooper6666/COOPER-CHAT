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

// --- 上帝控制台 (深青色版) ---
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('ACCESS DENIED');
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    let userRows = users.map(user => `<tr><td>[${user.name}]</td><td>${user.rooms ? user.rooms.join(',') : '大廳'}</td><td>${onlineUsers[user.name] ? '<b style="color:#4ecdc4;">ONLINE >> '+onlineUsers[user.name].ip+'</b>' : '<span style="color:#2c5d5d;">OFFLINE</span>'}</td></tr>`).join('');
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#0a1a1a;color:#4ecdc4;font-family:"Courier New",monospace;padding:20px;} .box{border:1px solid #145656;background:rgba(20,86,86,0.1);padding:20px;margin-bottom:20px;} input{background:#0a1a1a;border:1px solid #145656;color:#4ecdc4;padding:10px;margin:5px;width:80%;} button{background:#145656;color:#fff;border:none;padding:10px;font-weight:bold;cursor:pointer;width:100%;} table{width:100%;border-collapse:collapse;} th,td{padding:8px;border:1px solid #145656;text-align:left;} textarea{width:100%;height:150px;background:#000;color:#4ecdc4;border:1px solid #145656;}</style></head><body>
        <h2>COOPER_CONTROL_CENTER_v7.0</h2>
        <div class="box"><h3>NET_SCANNER</h3><table>${userRows}</table></div>
        <div class="box"><h3>ACCESS_GRANT</h3>帳號:<input id="nu">密碼:<input id="np">頻道:<input id="nr" value="大廳"><button onclick="addUser()">EXECUTE_GRANT</button></div>
        <div class="box"><h3>SYNC_DATA</h3><textarea id="syncBox" readonly>${JSON.stringify(users, null, 2)}</textarea><button onclick="copyCode()">COPY_JSON</button></div>
        <button onclick="location.href='/'" style="background:#222;color:#fff;">EXIT</button>
        <script>async function addUser(){const u=document.getElementById('nu').value,p=document.getElementById('np').value,r=document.getElementById('nr').value.split(',');if(!u||!p)return;await fetch('/api/add-user',{method:'POST',headers:'Content-Type':'application/json',body:JSON.stringify({u,p,r,adminU:'${ADMIN_NAME}',adminP:'${ADMIN_PASS}'})});location.reload();}function copyCode(){const t=document.getElementById('syncBox');t.select();document.execCommand('copy');alert('COPIED');}</script></body></html>`);
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
    :root { --deep: #145656; --glow: #4ecdc4; --dark: #0a1a1a; --text: #a8dadc; }
    body { margin:0; background: var(--dark); color: var(--text); font-family: 'Courier New', monospace; display:flex; flex-direction:column; height:100vh; overflow:hidden; }
    
    /* 質感波動啟動 */
    #loader { position:fixed; inset:0; background:var(--dark); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:9999; transition: opacity 0.5s; }
    .bubble { width:180px; height:180px; background: var(--deep); filter:blur(40px); opacity:0.3; animation:pulse 3s infinite alternate; border-radius:50%; }
    @keyframes pulse { from { transform:scale(0.8); opacity:0.2; } to { transform:scale(1.2); opacity:0.5; } }

    header { border-bottom: 2px solid var(--deep); padding:12px; display:flex; gap:10px; background: rgba(20,86,86,0.1); }
    #chat-box { flex:1; overflow-y:auto; padding:20px; scrollbar-width: thin; scrollbar-color: var(--deep) var(--dark); }
    
    .msg { margin-bottom: 18px; position:relative; max-width: 90%; }
    .msg-me { color: var(--glow); text-shadow: 0 0 5px rgba(78,205,196,0.3); }
    .msg-other { color: #88a0a0; }
    .msg small { color: var(--deep); font-size: 11px; font-weight:bold; }
    
    .input-bar { border-top: 2px solid var(--deep); padding:10px; display:flex; align-items:center; background: rgba(20,86,86,0.05); }
    #txt { flex:1; background:none; border:none; color:var(--glow); padding:12px; font-family:inherit; outline:none; font-size:16px; }
    .btn { padding:10px 20px; cursor:pointer; background: var(--deep); color:#fff; font-weight:bold; border-radius:4px; transition:0.3s; }
    .btn:hover { background: var(--glow); color: var(--dark); }
    
    #room-list button { background:none; border:1px solid var(--deep); color:var(--deep); cursor:pointer; padding:6px 12px; border-radius:2px; }
    #room-list button.active { border-color: var(--glow); color: var(--glow); background: rgba(78,205,196,0.1); }

    #auth-box { position:fixed; inset:0; background:var(--dark); z-index:1000; display:flex; align-items:center; justify-content:center; }
    .auth-card { border: 2px solid var(--deep); padding:40px; width:300px; text-align:center; background: rgba(20,86,86,0.05); }
    .auth-card h3 { color: var(--glow); margin-bottom:25px; letter-spacing:3px; }
    .auth-card input { width:100%; padding:12px; margin-bottom:15px; background:#000; border:1px solid var(--deep); color:var(--glow); box-sizing:border-box; outline:none; text-align:center; }
    
    .img-preview { max-width:250px; border:1px solid var(--deep); margin-top:8px; display:block; opacity:0.8; transition:0.3s; }
    .img-preview:hover { opacity:1; border-color: var(--glow); }
    </style></head>
    <body>
        <div id="loader"><div class="bubble"></div><h2 style="color:var(--glow); letter-spacing:5px;">SECURE_LINK</h2></div>
        
        <div id="auth-box">
            <div class="auth-card">
                <h3>COOPER_SEC_V6</h3>
                <input id="un" placeholder="IDENTIFIER">
                <input id="pw" type="password" placeholder="PASS_KEY">
                <button onclick="doL()" class="btn" style="width:100%; letter-spacing:5px;">LOGIN</button>
            </div>
        </div>

        <header id="room-list"></header>
        <div id="chat-box"></div>
        <div class="input-bar">
            <label style="padding:0 15px; cursor:pointer; color:var(--deep); font-weight:bold;">[+]<input type="file" id="fi" hidden onchange="upFile(this)"></label>
            <input id="txt" placeholder="TYPE_COMMAND_HERE..." autocomplete="off" onkeypress="if(event.key==='Enter')send()">
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
                                '<a href="/master-panel?u=CooperChen&p=11036666" style="color:#145656;font-size:10px;margin-left:auto;text-decoration:none;">[ROOT_CMD]</a>';
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
                d.className='msg '+(m.s===me.name?'msg-me':'msg-other');
                let content = ' >> ' + m.c;
                if(m.f) {
                    if(m.f.startsWith('data:image')) content += '<img src="'+m.f+'" class="img-preview">';
                    else content += '<br>[DATA_STREAM: '+m.fn+'] <a href="'+m.f+'" download="'+m.fn+'" style="color:var(--glow);">DOWNLOAD</a>';
                }
                d.innerHTML = '<small>'+m.s+' @ '+new Date().toLocaleTimeString()+'</small><br>'+content;
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
            socket.u = u; onlineUsers[u.name] = { ip: userIP };
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

http.listen(PORT, '0.0.0.0', () => console.log('DEEP_SEA_READY'));
