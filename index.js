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

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([{ name: ADMIN_NAME, pass: ADMIN_PASS, role: "admin", isMuted: false }], null, 2));
if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, JSON.stringify([]));

app.use(express.json({ limit: '100mb' }));

// --- 管理 API ---
app.post('/api/add-user', (req, res) => {
    const { u, p, adminU, adminP } = req.body;
    if (adminU !== ADMIN_NAME || adminP !== ADMIN_PASS) return res.sendStatus(403);
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    if(users.find(x => x.name === u)) return res.status(400).send('User exists');
    users.push({ name: u, pass: p, role: "user", isMuted: false });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.sendStatus(200);
});

// --- 上帝控制台 (日常專業版) ---
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('拒絕訪問');
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    let userRows = users.map(user => `
        <tr>
            <td><b>${user.name}</b></td>
            <td>${user.isMuted ? '<span style="color:#ff4d4d;">禁言中</span>' : '<span style="color:#2ecc71;">正常</span>'}</td>
            <td>${onlineUsers[user.name] ? '<small style="color:#145656;">🟢 ' + onlineUsers[user.name].ip + '</small>' : '<small style="color:#999;">🔴 離線</small>'}</td>
            <td style="text-align:right;">
                <button onclick="cmd('mute','${user.name}')" style="background:#f39c12;">禁言</button>
                <button onclick="cmd('delUser','${user.name}')" style="background:#e74c3c;">刪除</button>
            </td>
        </tr>`).join('');

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{background:#f4f7f6;color:#333;font-family:-apple-system,sans-serif;padding:20px;}
        .card{background:#fff;padding:25px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.05);margin-bottom:20px;max-width:800px;margin-inline:auto;}
        table{width:100%;border-collapse:collapse;} th,td{padding:12px;text-align:left;border-bottom:1px solid #eee;}
        button{color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:bold;margin-left:5px;}
        input{border:1px solid #ddd;padding:10px;border-radius:6px;width:150px;margin-right:10px;}
        h2{color:#145656;border-left:5px solid #145656;padding-left:15px;}
    </style></head><body>
        <div class="card">
            <h2>帳號管理中心</h2>
            <table><thead><tr><th>用戶名</th><th>狀態</th><th>IP 資訊</th><th style="text-align:right;">操作</th></tr></thead><tbody>${userRows}</tbody></table>
        </div>
        <div class="card">
            <h3>新增授權帳號</h3>
            <input id="nu" placeholder="帳號名稱"> <input id="np" placeholder="存取密碼"> 
            <button onclick="addUser()" style="background:#145656;">執行新增</button>
        </div>
        <div style="text-align:center;"><button onclick="location.href='/'" style="background:#95a5a6;padding:10px 40px;">返回聊天室</button></div>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            function cmd(a, t){ if(confirm('確定要執行此操作？')){ socket.emit('god_cmd', {a, t, n:'${ADMIN_NAME}', p:'${ADMIN_PASS}'}); setTimeout(()=>location.reload(),300); } }
            async function addUser(){
                const u=document.getElementById('nu').value, p=document.getElementById('np').value;
                if(!u||!p) return;
                await fetch('/api/add-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u,p,adminU:'${ADMIN_NAME}',adminP:'${ADMIN_PASS}'})});
                location.reload();
            }
        </script></body></html>`);
});

// --- 主介面渲染 (現代日常風) ---
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0"><style>
    :root { --main: #145656; --bg: #f0f2f5; --chat-bg: #ffffff; }
    body { margin:0; background: var(--bg); color: #444; font-family: 'PingFang TC', 'Microsoft JhengHei', sans-serif; display:flex; flex-direction:column; height:100vh; }
    
    /* 登入視窗 */
    #auth { position:fixed; inset:0; background:var(--bg); z-index:1000; display:flex; align-items:center; justify-content:center; }
    .auth-card { background:#fff; padding:40px; border-radius:16px; box-shadow:0 10px 25px rgba(0,0,0,0.1); width:85%; max-width:320px; text-align:center; }
    .auth-card input { width:100%; padding:14px; margin-bottom:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; outline:none; font-size:16px; }
    .auth-card button { width:100%; padding:14px; background:var(--main); color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:16px; }

    header { background:#fff; padding:15px 20px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 10px rgba(0,0,0,0.05); z-index:10; }
    #chat-box { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:12px; }
    
    /* 訊息對話框 */
    .msg { max-width:80%; padding:10px 14px; border-radius:18px; line-height:1.5; font-size:15px; position:relative; word-wrap:break-word; }
    .msg-other { align-self:flex-start; background: #fff; color:#333; border-bottom-left-radius:4px; box-shadow:0 2px 5px rgba(0,0,0,0.05); }
    .msg-me { align-self:flex-end; background: var(--main); color:#fff; border-bottom-right-radius:4px; }
    .msg small { display:block; font-size:11px; margin-bottom:4px; opacity:0.7; }
    
    /* 輸入欄位 */
    .input-area { background:#fff; padding:12px 15px; display:flex; gap:10px; align-items:center; border-top:1px solid #eee; }
    #txt { flex:1; background:#f0f2f5; border:none; padding:12px 18px; border-radius:24px; outline:none; font-size:16px; }
    .btn-circle { width:42px; height:42px; background:var(--main); color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; border:none; font-size:18px; }
    .img-preview { max-width:100%; border-radius:12px; margin-top:8px; display:block; }
    </style></head>
    <body>
        <div id="auth">
            <div class="auth-card">
                <h2 style="color:var(--main);margin-top:0;">CooperChat</h2>
                <input id="un" placeholder="使用者名稱">
                <input id="pw" type="password" placeholder="存取密碼">
                <button onclick="doL()">登入</button>
            </div>
        </div>
        <header>
            <b style="color:var(--main);font-size:18px;">Cooper 交流站</b>
            <button id="god-link" onclick="location.href='/master-panel?u=CooperChen&p=11036666'" style="display:none;background:none;border:1px solid #e74c3c;color:#e74c3c;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:12px;">上帝模式</button>
        </header>
        <div id="chat-box"></div>
        <div class="input-area">
            <label style="font-size:24px;cursor:pointer;">📎<input type="file" id="fi" hidden onchange="upFile(this)"></label>
            <input id="txt" placeholder="輸入訊息..." onkeypress="if(event.key==='Enter')send()">
            <button class="btn-circle" onclick="send()">➔</button>
        </div>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket=io(); let me=null;
            function doL(){ socket.emit('login',{u:document.getElementById('un').value, p:document.getElementById('pw').value}); }
            socket.on('auth_ok', d=>{ 
                me=d; document.getElementById('auth').style.display='none'; 
                if(me.name==='${ADMIN_NAME}') document.getElementById('god-link').style.display='block';
            });
            function upFile(el){
                const f=el.files[0]; if(!f)return;
                const r=new FileReader(); r.onload=e=>{ socket.emit('msg',{c:'', f:e.target.result, fn:f.name}); }; r.readAsDataURL(f); el.value='';
            }
            function send(){ const t=document.getElementById('txt'); if(t.value.trim()){ socket.emit('msg',{c:t.value}); t.value=''; } }
            socket.on('history', logs => { document.getElementById('chat-box').innerHTML=''; logs.forEach(addMsg); });
            socket.on('new_msg', addMsg);
            function addMsg(m) {
                const b=document.getElementById('chat-box'), d=document.createElement('div');
                d.className='msg '+(m.s===me.name?'msg-me':'msg-other');
                let content = m.c;
                if(m.f) content += m.f.startsWith('data:image') ? '<img src="'+m.f+'" class="img-preview">' : '<br><a href="'+m.f+'" download="'+m.fn+'" style="color:inherit;text-decoration:underline;">📂 '+m.fn+'</a>';
                d.innerHTML = (m.s===me.name?'':'<small>'+m.s+'</small>') + content;
                b.appendChild(d); b.scrollTop=b.scrollHeight;
            }
        </script></body></html>`);
});

// --- Socket 邏輯 (保持原有強大功能) ---
io.on('connection', (socket) => {
    const userIP = (socket.handshake.headers['x-forwarded-for'] || socket.handshake.address).split(',')[0];
    socket.on('login', (d) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const u = users.find(x => x.name === d.u && x.pass === d.p);
        if (u) {
            socket.u = u; onlineUsers[u.name] = { ip: userIP };
            socket.emit('auth_ok', { name: u.name });
            socket.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)).slice(-100));
        } else { socket.emit('err', '登入失敗'); }
    });
    socket.on('msg', (p) => {
        if (!socket.u) return;
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        if(users.find(x => x.name === socket.u.name).isMuted) return;
        const m = { s: socket.u.name, c: p.c, f: p.f, fn: p.fn, t: new Date().toLocaleTimeString() };
        let msgs = JSON.parse(fs.readFileSync(MSGS_FILE));
        msgs.push(m); fs.writeFileSync(MSGS_FILE, JSON.stringify(msgs.slice(-500)));
        io.emit('new_msg', m);
    });
    socket.on('god_cmd', (d) => {
        if(d.n === ADMIN_NAME && d.p === ADMIN_PASS) {
            let users = JSON.parse(fs.readFileSync(USERS_FILE));
            if(d.a === 'mute') { let t = users.find(u => u.name === d.t); if(t) t.isMuted = !t.isMuted; }
            else if(d.a === 'delUser') { users = users.filter(u => u.name !== d.t); }
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            io.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)));
        }
    });
    socket.on('disconnect', () => { if(socket.u) delete onlineUsers[socket.u.name]; });
});

http.listen(PORT, '0.0.0.0', () => console.log('CooperChat 7.0 Active'));
