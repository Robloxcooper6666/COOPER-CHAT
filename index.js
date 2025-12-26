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

// --- 上帝控制台 (絕對專業版) ---
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('ACCESS DENIED');
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const msgs = JSON.parse(fs.readFileSync(MSGS_FILE));
    
    let userRows = users.map(user => `
        <tr style="border-bottom:1px solid #145656;">
            <td>${user.name}</td>
            <td>${user.isMuted ? '<span style="color:red;">禁言中</span>' : '<span style="color:#0f0;">正常</span>'}</td>
            <td>${onlineUsers[user.name] ? '<b style="color:#4ecdc4;">🟢 ' + onlineUsers[user.name].ip + '</b>' : '<span style="color:#444;">🔴 離線</span>'}</td>
            <td>
                <button onclick="cmd('mute','${user.name}')">禁言/解禁</button>
                <button onclick="cmd('delUser','${user.name}')" style="background:red;">刪除</button>
            </td>
        </tr>
    `).join('');

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{background:#0a1a1a;color:#4ecdc4;font-family:monospace;padding:20px;}
        .box{border:1px solid #145656;background:rgba(20,86,86,0.1);padding:20px;margin-bottom:20px;}
        table{width:100%;border-collapse:collapse;} th,td{padding:12px;text-align:left;border-bottom:1px solid #145656;}
        button{background:#145656;color:#fff;border:none;padding:8px 15px;cursor:pointer;font-family:monospace;}
        input{background:#000;border:1px solid #145656;color:#4ecdc4;padding:8px;margin-right:10px;}
    </style></head><body>
        <h2>[ COOPER_GOD_INTERFACE_v7.0 ]</h2>
        <div class="box">
            <h3>使用者管理系統</h3>
            <table><thead><tr><th>名稱</th><th>狀態</th><th>最後IP/狀態</th><th>操作</th></tr></thead><tbody>${userRows}</tbody></table>
        </div>
        <div class="box">
            <h3>快速授權</h3>
            帳號:<input id="nu"> 密碼:<input id="np"> <button onclick="addUser()">執行授權</button>
        </div>
        <div class="box">
            <h3>系統權限</h3>
            <button onclick="cmd('clearAll','')" style="background:#551a1a;width:100%;">🔥 摧毀所有對話紀錄 (慎用)</button>
        </div>
        <button onclick="location.href='/'" style="background:#333;width:100%;margin-top:20px;">返回終端機</button>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            function cmd(a, t){
                if(confirm('確定執行指令 ' + a + '?')){
                    socket.emit('god_cmd', {a, t, n:'${ADMIN_NAME}', p:'${ADMIN_PASS}'});
                    setTimeout(()=>location.reload(), 300);
                }
            }
            async function addUser(){
                const u=document.getElementById('nu').value, p=document.getElementById('np').value;
                if(!u||!p) return;
                await fetch('/api/add-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u,p,adminU:'${ADMIN_NAME}',adminP:'${ADMIN_PASS}'})});
                location.reload();
            }
        </script></body></html>`);
});

// API: 新增帳號
app.post('/api/add-user', (req, res) => {
    const { u, p, adminU, adminP } = req.body;
    if (adminU !== ADMIN_NAME || adminP !== ADMIN_PASS) return res.sendStatus(403);
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    if(users.find(x => x.name === u)) return res.status(400).send('User exists');
    users.push({ name: u, pass: p, role: "user", isMuted: false });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.sendStatus(200);
});

// --- 主介面渲染 ---
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>
    :root { --deep: #145656; --glow: #4ecdc4; --dark: #0a1a1a; }
    body { margin:0; background: var(--dark); color: #a8dadc; font-family: 'Courier New', monospace; display:flex; flex-direction:column; height:100vh; overflow:hidden; }
    #loader { position:fixed; inset:0; background:var(--dark); display:flex; align-items:center; justify-content:center; z-index:9999; transition:0.5s; }
    header { border-bottom: 2px solid var(--deep); padding:15px; display:flex; justify-content:space-between; align-items:center; }
    #chat-box { flex:1; overflow-y:auto; padding:20px; }
    .msg { margin-bottom:15px; border-left: 2px solid var(--deep); padding-left:12px; }
    .msg-me { border-left: 2px solid var(--glow); color:#fff; }
    .input-bar { border-top: 2px solid var(--deep); padding:15px; display:flex; gap:10px; background:rgba(20,86,86,0.1); }
    #txt { flex:1; background:none; border:none; color:var(--glow); outline:none; font-family:inherit; font-size:16px; }
    .btn { background:var(--deep); color:#fff; border:none; padding:10px 20px; cursor:pointer; font-weight:bold; }
    #auth { position:fixed; inset:0; background:#000; z-index:1000; display:flex; align-items:center; justify-content:center; }
    .auth-card { border: 2px solid var(--deep); padding:40px; text-align:center; background:#051010; }
    .auth-card input { display:block; margin:10px auto; padding:10px; background:#000; border:1px solid var(--deep); color:var(--glow); text-align:center; }
    .img-preview { max-width:250px; border:1px solid var(--deep); margin-top:8px; display:block; }
    </style></head>
    <body>
        <div id="loader"><h2>CONNECTING...</h2></div>
        <div id="auth">
            <div class="auth-card">
                <h3>DEEP_SEA_LINK_V7</h3>
                <input id="un" placeholder="IDENTIFIER">
                <input id="pw" type="password" placeholder="PASS_KEY">
                <button onclick="doL()" class="btn" style="width:100%">ACCESS</button>
            </div>
        </div>
        <header>
            <b>[ SYSTEM_STATION ]</b>
            <a id="god-link" href="/master-panel?u=${ADMIN_NAME}&p=${ADMIN_PASS}" style="display:none;color:red;text-decoration:none;">[GOD_MODE]</a>
        </header>
        <div id="chat-box"></div>
        <div class="input-bar">
            <label style="cursor:pointer;color:var(--deep)">[FILE]<input type="file" id="fi" hidden onchange="upFile(this)"></label>
            <input id="txt" placeholder="COMMAND_INPUT..." onkeypress="if(event.key==='Enter')send()">
            <button onclick="send()" class="btn">SEND</button>
        </div>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket=io(); let me=null;
            socket.on('connect', () => { setTimeout(()=>document.getElementById('loader').style.display='none',500); });
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
                d.className='msg '+(m.s===me.name?'msg-me':'');
                let content = '>> ' + m.c;
                if(m.f) content += m.f.startsWith('data:image') ? '<img src="'+m.f+'" class="img-preview">' : '<br>[FILE: '+m.fn+'] <a href="'+m.f+'" download="'+m.fn+'" style="color:var(--glow);">DOWNLOAD</a>';
                d.innerHTML = '<small>['+m.s+'] '+m.t+'</small><br>'+content;
                b.appendChild(d); b.scrollTop=b.scrollHeight;
            }
            socket.on('err', msg => alert(msg));
        </script></body></html>`);
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
            socket.emit('auth_ok', { name: u.name });
            socket.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)).slice(-100));
        } else { socket.emit('err', 'ACCESS_DENIED'); }
    });

    socket.on('msg', (p) => {
        if (!socket.u) return;
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const user = users.find(x => x.name === socket.u.name);
        if(user.isMuted) return socket.emit('err', 'SYSTEM: YOU_ARE_MUTED');

        const m = { s: socket.u.name, c: p.c, f: p.f, fn: p.fn, t: new Date().toLocaleTimeString() };
        let msgs = JSON.parse(fs.readFileSync(MSGS_FILE));
        msgs.push(m);
        fs.writeFileSync(MSGS_FILE, JSON.stringify(msgs.slice(-500)));
        io.emit('new_msg', m);
    });

    socket.on('god_cmd', (d) => {
        if(d.n === ADMIN_NAME && d.p === ADMIN_PASS) {
            if(d.a === 'clearAll') fs.writeFileSync(MSGS_FILE, "[]");
            else if(d.a === 'mute') {
                let users = JSON.parse(fs.readFileSync(USERS_FILE));
                let target = users.find(u => u.name === d.t);
                if(target) target.isMuted = !target.isMuted;
                fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            }
            else if(d.a === 'delUser') {
                let users = JSON.parse(fs.readFileSync(USERS_FILE));
                users = users.filter(u => u.name !== d.t);
                fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            }
            io.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)));
        }
    });

    socket.on('disconnect', () => { if(socket.u) delete onlineUsers[socket.u.name]; });
});

http.listen(PORT, '0.0.0.0', () => console.log('STATION_ONLINE'));
