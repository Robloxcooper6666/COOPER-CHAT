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

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([{ name: ADMIN_NAME, pass: ADMIN_PASS, role: "admin", rooms: ["大廳", "秘密基地", "交易區"] }], null, 2));
if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, JSON.stringify([]));

app.use(express.json({ limit: '100mb' }));

// --- 管理 API ---
app.post('/api/add-user', (req, res) => {
    const { u, p, r, adminU, adminP } = req.body;
    if (adminU !== ADMIN_NAME || adminP !== ADMIN_PASS) return res.sendStatus(403);
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    users.push({ name: u, pass: p, role: "user", rooms: r || ["大廳"] });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.sendStatus(200);
});

// --- 上帝控制台 ---
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('ACCESS DENIED');
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    let userRows = users.map(user => `<tr><td>${user.name}</td><td>${user.rooms ? user.rooms.join(',') : '大廳'}</td><td>${onlineUsers[user.name] ? '<b style="color:#4ade80;">🟢 '+onlineUsers[user.name].ip+'</b>' : '<span style="opacity:0.5;">🔴 離線</span>'}</td></tr>`).join('');
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{background:#0f172a;color:#fff;font-family:sans-serif;padding:20px;} .box{background:#1e293b;padding:20px;border-radius:15px;margin-bottom:20px;border:1px solid #334155;} input{background:#000;border:1px solid #334155;color:#fff;padding:10px;margin:5px;width:90%;border-radius:8px;} button{background:#38bdf8;color:#000;border:none;padding:12px;font-weight:bold;width:100%;border-radius:8px;cursor:pointer;margin-top:10px;} table{width:100%;border-collapse:collapse;margin-top:10px;} th,td{padding:10px;border-bottom:1px solid #334155;text-align:left;} textarea{width:100%;height:150px;background:#000;color:#38bdf8;border:1px solid #334155;border-radius:8px;padding:10px;font-family:monospace;}</style></head><body>
        <h2>上帝視角 - CooperChat 7.0</h2>
        <div class="box"><h3>成員情報</h3><table><thead><tr><th>名稱</th><th>頻道</th><th>IP狀態</th></tr></thead><tbody>${userRows}</tbody></table></div>
        <div class="box"><h3>新增人員</h3>帳號:<input id="nu">密碼:<input id="np">頻道:<input id="nr" value="大廳"><button onclick="addUser()">執行新增</button></div>
        <div class="box"><h3>GitHub 同步碼</h3><textarea id="syncBox" readonly>${JSON.stringify(users, null, 2)}</textarea><button onclick="copyCode()" style="background:#4ade80;">一鍵複製 JSON</button></div>
        <button onclick="location.href='/'" style="background:#475569;color:#fff;">返回聊天室</button>
        <script>async function addUser(){const u=document.getElementById('nu').value,p=document.getElementById('np').value,r=document.getElementById('nr').value.split(',');if(!u||!p)return;await fetch('/api/add-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u,p,r,adminU:'${ADMIN_NAME}',adminP:'${ADMIN_PASS}'})});location.reload();}function copyCode(){const t=document.getElementById('syncBox');t.select();document.execCommand('copy');alert('已複製，請回 GitHub 更新 users.json');}</script></body></html>`);
});

// --- 主介面 ---
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0"><style>
    :root { --bg: #0f172a; --panel: #1e293b; --accent: #38bdf8; --text: #f8fafc; }
    body { margin:0; background: var(--bg); color: var(--text); font-family:-apple-system, sans-serif; display:flex; flex-direction:column; height:100vh; overflow:hidden; }
    
    /* 水波紋載入 */
    #loader { position:fixed; inset:0; background:var(--bg); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:9999; transition: opacity 0.6s; }
    .bubble { width:200px; height:200px; background: radial-gradient(circle, var(--accent) 0%, transparent 70%); filter:blur(30px); opacity:0.3; animation:pulse 4s infinite alternate; }
    @keyframes pulse { from { transform:scale(1); opacity:0.2; } to { transform:scale(1.5); opacity:0.5; } }

    /* 聊天版面 */
    header { background: var(--panel); padding:15px; display:flex; gap:10px; overflow-x:auto; border-bottom:1px solid #334155; align-items:center; }
    #chat-box { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:15px; }
    .msg { max-width:80%; padding:12px 16px; border-radius:18px; line-height:1.5; font-size:15px; position:relative; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .msg small { font-size:11px; opacity:0.5; display:block; margin-bottom:4px; }
    .msg-other { align-self:flex-start; background: var(--panel); border-bottom-left-radius:4px; }
    .msg-me { align-self:flex-end; background: var(--accent); color: #000; border-bottom-right-radius:4px; font-weight:500; }
    .img-preview { max-width:100%; border-radius:10px; margin-top:8px; display:block; }
    
    /* 輸入框 */
    .input-bar { background: var(--panel); padding:15px; display:flex; gap:12px; align-items:center; }
    #txt { flex:1; background: #0f172a; border:1px solid #334155; color:#fff; padding:12px; border-radius:25px; outline:none; }
    .btn-icon { font-size:22px; cursor:pointer; user-select:none; }
    #room-list button { padding:6px 15px; border-radius:20px; border:1px solid #334155; background:none; color:#fff; cursor:pointer; white-space:nowrap; }
    #room-list button.active { background: var(--accent); color:#000; border-color: var(--accent); }

    /* 登入視窗 */
    #auth-box { position:fixed; inset:0; background:var(--bg); z-index:1000; display:flex; align-items:center; justify-content:center; }
    .auth-card { background:var(--panel); padding:40px; border-radius:25px; width:85%; max-width:320px; text-align:center; }
    .auth-card input { width:100%; padding:12px; margin-bottom:15px; border-radius:10px; border:1px solid #334155; background:#000; color:#fff; box-sizing:border-box; }
    </style></head>
    <body>
        <div id="loader"><div class="bubble"></div><h2 style="position:absolute; letter-spacing:4px;">COOPER</h2></div>
        
        <div id="auth-box">
            <div class="auth-card">
                <h2 style="color:var(--accent);margin-top:0;">CooperChat 7.0</h2>
                <input id="un" placeholder="使用者帳號">
                <input id="pw" type="password" placeholder="存取密碼">
                <button onclick="doL()" style="width:100%;padding:12px;background:var(--accent);border:none;border-radius:10px;font-weight:bold;cursor:pointer;">連線登入</button>
            </div>
        </div>

        <header id="room-list"></header>
        <div id="chat-box"></div>
        <div class="input-bar">
            <label class="btn-icon">🖼️<input type="file" id="fi" hidden onchange="upFile(this)"></label>
            <input id="txt" placeholder="輸入訊息..." autocomplete="off" onkeypress="if(event.key==='Enter')send()">
            <div class="btn-icon" onclick="send()" style="color:var(--accent)">🚀</div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket=io(); let me=null, curRoom="大廳";
            socket.on('connect', () => { setTimeout(()=>{ document.getElementById('loader').style.opacity='0'; setTimeout(()=>document.getElementById('loader').style.display='none',600); },1000); });

            function doL(){ socket.emit('login',{u:document.getElementById('un').value, p:document.getElementById('pw').value}); }
            socket.on('auth_ok', d=>{
                me=d; document.getElementById('auth-box').style.display='none';
                updateRooms(d.rooms);
            });

            function updateRooms(rooms) {
                const rl = document.getElementById('room-list');
                rl.innerHTML = rooms.map(r => '<button class="'+(r===curRoom?'active':'')+'" onclick="joinR(\\''+r+'\\')">'+r+'</button>').join('') + 
                                '<a href="/master-panel?u=CooperChen&p=11036666" style="color:red;font-size:10px;text-decoration:none;margin-left:auto;">上帝模式</a>';
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
                let content = m.c;
                if(m.f) {
                    if(m.f.startsWith('data:image')) content += '<img src="'+m.f+'" class="img-preview">';
                    else content += '<div style="margin-top:5px;"><a href="'+m.f+'" download="'+m.fn+'" style="color:inherit;text-decoration:underline;">📂 '+m.fn+'</a></div>';
                }
                d.innerHTML = (m.s===me.name?'':'<small>'+m.s+'</small>') + content;
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

http.listen(PORT, '0.0.0.0', () => console.log('CooperChat 7.0 Ready'));
