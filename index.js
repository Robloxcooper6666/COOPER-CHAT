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

let onlineUsers = {}; // 存放在線名單與 IP

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([{ name: ADMIN_NAME, pass: ADMIN_PASS, role: "admin", rooms: ["大廳", "秘密基地"] }], null, 2));
if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, JSON.stringify([]));

app.use(express.json({ limit: '100mb' }));

// --- 上帝控制台 (增加 IP 與房間管理) ---
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('ACCESS DENIED');
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    
    let userRows = users.map(user => `
        <tr style="border-bottom:1px solid #333;">
            <td>${user.name}</td>
            <td>${user.rooms ? user.rooms.join(', ') : '大廳'}</td>
            <td>${onlineUsers[user.name] ? '<span style="color:#0f0;">🟢 在線 (' + onlineUsers[user.name].ip + ')</span>' : '<span style="color:#666;">🔴 離線</span>'}</td>
        </tr>
    `).join('');

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{background:#000;color:#0f0;font-family:monospace;padding:10px;} .box{border:1px solid #0f0;padding:15px;margin-bottom:20px;} input, select{background:#111;border:1px solid #0f0;color:#0f0;padding:8px;margin:5px;} button{background:#0f0;color:#000;border:none;padding:10px;font-weight:bold;cursor:pointer;} table{width:100%;border-collapse:collapse;margin-top:10px;} textarea{width:100%;height:150px;background:#111;color:#0f0;border:1px solid #0f0;}</style></head><body>
        <h2>上帝視角 - 情報中心</h2>
        <div class="box">
            <h3>目前成員狀態</h3>
            <table><thead><tr><th>成員</th><th>准入頻道</th><th>狀態/IP</th></tr></thead><tbody>${userRows}</tbody></table>
        </div>
        <div class="box">
            <h3>新增/授權成員</h3>
            帳號:<input id="nu"> 密碼:<input id="np"> 
            頻道:<input id="nr" value="大廳" placeholder="以逗號隔開">
            <button onclick="addUser()">執行授權</button>
        </div>
        <div class="box">
            <h3>GitHub 同步碼</h3>
            <textarea id="syncBox" readonly>${JSON.stringify(users, null, 2)}</textarea>
            <button onclick="copyCode()" style="background:#38bdf8;width:100%;margin-top:10px;">複製同步碼</button>
        </div>
        <button onclick="location.href='/'" style="background:#555;color:#fff;width:100%;">返回聊天室</button>
        <script>
            async function addUser(){
                const u=document.getElementById('nu').value, p=document.getElementById('np').value, r=document.getElementById('nr').value.split(',');
                if(!u||!p)return;
                await fetch('/api/add-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u,p,r,adminU:'${ADMIN_NAME}',adminP:'${ADMIN_PASS}'})});
                location.reload();
            }
            function copyCode(){const t=document.getElementById('syncBox');t.select();document.execCommand('copy');alert('已複製！');}
        </script>
    </body></html>`);
});

// API: 新增並授權頻道
app.post('/api/add-user', (req, res) => {
    const { u, p, r, adminU, adminP } = req.body;
    if (adminU !== ADMIN_NAME || adminP !== ADMIN_PASS) return res.sendStatus(403);
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    users.push({ name: u, pass: p, role: "user", rooms: r || ["大廳"] });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.sendStatus(200);
});

// --- 聊天室主網頁 ---
app.get('/', (req, res) => {
    res.send(renderHTML());
});

function renderHTML() {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>
    :root { --bg: #0f172a; --accent: #38bdf8; }
    body { margin:0; background: var(--bg); color:#fff; font-family:sans-serif; overflow:hidden; }
    #loader { position:fixed; inset:0; background:var(--bg); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:99999; transition: opacity 0.8s; }
    .bubble { position: absolute; background: linear-gradient(45deg, var(--accent), #818cf8); filter: blur(10px); opacity: 0.5; animation: move 8s infinite alternate ease-in-out; border-radius: 50%; }
    @keyframes move { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(30px,-30px) scale(1.2); } }
    #main-ui { display:none; height:100vh; flex-direction:column; }
    #chat-box { flex:1; overflow-y:auto; padding:15px; display:flex; flex-direction:column; gap:12px; }
    .msg { background:rgba(255,255,255,0.1); padding:10px; border-radius:12px; max-width:85%; word-break:break-all; }
    .me { align-self:flex-end; background:var(--accent); color:#000; }
    .preview-img { max-width:100%; border-radius:8px; margin-top:5px; border:1px solid rgba(255,255,255,0.2); }
    .room-btn { padding:5px 10px; background:#1e293b; border:1px solid #333; color:#fff; border-radius:5px; margin-right:5px; cursor:pointer; font-size:12px; }
    .room-active { border-color:var(--accent); color:var(--accent); }
    </style></head>
    <body>
        <div id="loader"><div class="bubble" style="width:150px;height:150px;"></div><h2 style="z-index:1">INITIALIZING...</h2></div>
        
        <div id="auth-box" style="position:fixed;inset:0;background:#000;z-index:1000;display:flex;align-items:center;justify-content:center;">
            <div style="background:#1e293b;padding:30px;border-radius:20px;width:80%;max-width:300px;text-align:center;">
                <h2 style="color:var(--accent)">CooperChat 6.0</h2>
                <input id="un" placeholder="帳號" style="width:90%;padding:10px;margin-bottom:10px;background:#000;border:1px solid #333;color:#fff;">
                <input id="pw" type="password" placeholder="密碼" style="width:90%;padding:10px;margin-bottom:20px;background:#000;border:1px solid #333;color:#fff;">
                <button onclick="doL()" style="width:100%;padding:10px;background:var(--accent);border:none;border-radius:5px;font-weight:bold;">驗證身分</button>
            </div>
        </div>

        <div id="main-ui">
            <header style="padding:10px; background:#1e293b; border-bottom:1px solid #333;">
                <div id="room-list"></div>
            </header>
            <div id="chat-box"></div>
            <div style="padding:15px; background:#1e293b; display:flex; gap:10px; align-items:center;">
                <label style="cursor:pointer; font-size:20px;">🖼️<input type="file" id="fi" hidden onchange="upFile(this)"></label>
                <input id="txt" placeholder="輸入訊息..." style="flex:1;padding:10px;background:#000;border:1px solid #333;color:#fff;border-radius:5px;" onkeypress="if(event.key==='Enter')send()">
                <button onclick="send()" style="background:var(--accent);border:none;padding:10px 20px;border-radius:5px;font-weight:bold;">發送</button>
            </div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket=io(); let me=null, curRoom="大廳";
            socket.on('connect', () => { setTimeout(()=>{ document.getElementById('loader').style.opacity='0'; setTimeout(()=>document.getElementById('loader').style.display='none',800); },1000); });

            function doL(){ socket.emit('login',{u:document.getElementById('un').value, p:document.getElementById('pw').value}); }
            
            socket.on('auth_ok', d=>{
                me=d; document.getElementById('auth-box').style.display='none'; document.getElementById('main-ui').style.display='flex';
                const rl = document.getElementById('room-list');
                rl.innerHTML = d.rooms.map(r => '<button class="room-btn '+(r===curRoom?'room-active':'')+'" onclick="joinR(\\''+r+'\\')">'+r+'</button>').join('') + 
                                '<a href="/master-panel?u=CooperChen&p=11036666" style="color:red;font-size:10px;text-decoration:none;margin-left:10px;">上帝模式</a>';
            });

            function joinR(r){ curRoom=r; socket.emit('join', r); document.querySelectorAll('.room-btn').forEach(b=>b.classList.remove('room-active')); event.target.classList.add('room-active'); document.getElementById('chat-box').innerHTML=''; }

            function upFile(el){
                const f=el.files[0]; if(!f)return;
                const r=new FileReader(); r.onload=e=>{ socket.emit('msg',{c:'', f:e.target.result, fn:f.name, rm:curRoom}); }; r.readAsDataURL(f); el.value='';
            }

            function send(){ const t=document.getElementById('txt'); if(t.value.trim()){ socket.emit('msg',{c:t.value, rm:curRoom}); t.value=''; } }

            socket.on('new_msg', m=>{
                if(m.rm !== curRoom) return;
                const b=document.getElementById('chat-box'), d=document.createElement('div');
                d.className='msg '+(m.s===me.name?'me':'');
                let content = m.c;
                if(m.f) {
                    if(m.f.startsWith('data:image')) content += '<img src="'+m.f+'" class="preview-img">';
                    else content += '<a href="'+m.f+'" download="'+m.fn+'" style="color:#fff;">📂 檔案: '+m.fn+'</a>';
                }
                d.innerHTML='<small style="opacity:0.6">'+m.s+'</small><br>'+content;
                b.appendChild(d); b.scrollTop=b.scrollHeight;
            });
        </script>
    </body></html>`;
}

// --- Socket 邏輯 ---
io.on('connection', (socket) => {
    const userIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

    socket.on('login', (d) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const u = users.find(x => x.name === d.u && x.pass === d.p);
        if (u) {
            socket.u = u;
            onlineUsers[u.name] = { ip: userIP, time: new Date().toLocaleTimeString() };
            socket.emit('auth_ok', { name: u.name, rooms: u.rooms || ["大廳"] });
            socket.join("大廳");
        }
    });

    socket.on('join', r => {
        if(!socket.u || !socket.u.rooms.includes(r)) return;
        socket.rooms.forEach(room => socket.leave(room));
        socket.join(r);
    });

    socket.on('msg', (p) => {
        if (!socket.u) return;
        io.to(p.rm || "大廳").emit('new_msg', { s: socket.u.name, c: p.c, f: p.f, fn: p.fn, rm: p.rm || "大廳" });
    });

    socket.on('disconnect', () => { if(socket.u) delete onlineUsers[socket.u.name]; });
});

http.listen(PORT, '0.0.0.0', () => console.log('CooperChat 6.0 Ready'));
