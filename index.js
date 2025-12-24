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

// 初始化檔案
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([{ name: ADMIN_NAME, pass: ADMIN_PASS, role: "admin" }], null, 2));
if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, JSON.stringify([]));

app.use(express.json({ limit: '50mb' }));

// --- API 區 ---
app.post('/api/add-user', (req, res) => {
    const { u, p, adminU, adminP } = req.body;
    if (adminU !== ADMIN_NAME || adminP !== ADMIN_PASS) return res.sendStatus(403);
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    users.push({ name: u, pass: p, role: "user" });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.sendStatus(200);
});

// --- 上帝同步控制台 ---
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('拒絕存取');
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{background:#000;color:#0f0;font-family:monospace;padding:20px;}.box{border:1px solid #0f0;padding:15px;margin-bottom:20px;}input{background:#111;border:1px solid #0f0;color:#0f0;padding:8px;margin:5px;width:80%;}button{background:#0f0;color:#000;border:none;padding:12px;font-weight:bold;width:100%;cursor:pointer;}textarea{width:100%;height:200px;background:#111;color:#0f0;border:1px solid #0f0;margin-top:10px;}</style></head><body><h2>COOPER GOD MODE</h2><div class="box"><h3>快速新增人頭</h3><input id="nu" placeholder="新帳號"><br><input id="np" placeholder="新密碼"><br><button onclick="addUser()">確認新增</button></div><div class="box"><h3>GitHub 同步碼 (貼回 users.json)</h3><textarea id="syncBox" readonly>${JSON.stringify(users, null, 2)}</textarea><br><br><button onclick="copyCode()" style="background:#38bdf8">一鍵複製同步碼</button></div><button onclick="location.href='/'" style="background:#555;color:#fff">返回聊天室</button><script>async function addUser(){const u=document.getElementById('nu').value,p=document.getElementById('np').value;if(!u||!p)return;await fetch('/api/add-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u,p,adminU:'${ADMIN_NAME}',adminP:'${ADMIN_PASS}'})});location.reload();}function copyCode(){const t=document.getElementById('syncBox');t.select();document.execCommand('copy');alert('已複製！請去 GitHub 修改 users.json');}</script></body></html>`);
});

// --- 聊天室主頁 (含波動加載動畫) ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>CooperChat 6.0</title>
<style>
    :root { --bg: #0f172a; --accent: #38bdf8; }
    body { margin:0; background: var(--bg); color:#fff; font-family:sans-serif; overflow:hidden; }
    /* 波動動畫 CSS */
    #loader { position:fixed; inset:0; background:var(--bg); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:99999; transition: opacity 0.8s; }
    .visual-container { position: relative; width: 250px; height: 250px; }
    .bubble { position: absolute; background: linear-gradient(45deg, var(--accent), #818cf8); filter: blur(8px); opacity: 0.6; animation: move 8s infinite alternate ease-in-out; border-radius: 50%; }
    .b1 { width: 150px; height: 150px; top: 10%; left: 10%; animation-duration: 6s; }
    .b2 { width: 120px; height: 120px; bottom: 10%; right: 10%; animation-duration: 9s; opacity: 0.4; }
    @keyframes move { 
        0% { transform: translate(0,0) scale(1); border-radius: 40% 60% 60% 40%/40% 40% 60% 60%; }
        100% { transform: translate(20px,-20px) scale(1.1); border-radius: 60% 40% 40% 60%/60% 60% 40% 40%; }
    }
    #main-ui { display:none; height:100vh; flex-direction:column; }
    #auth-box { position:fixed; inset:0; background:rgba(0,0,0,0.9); display:flex; align-items:center; justify-content:center; z-index:1000; }
    .glass { background:rgba(30,41,59,0.7); backdrop-filter:blur(10px); padding:30px; border-radius:20px; text-align:center; border:1px solid rgba(255,255,255,0.1); width:80%; max-width:300px; }
    #chat-box { flex:1; overflow-y:auto; padding:15px; display:flex; flex-direction:column; gap:10px; }
    .msg { background:rgba(255,255,255,0.1); padding:10px; border-radius:10px; max-width:80%; }
    .me { align-self:flex-end; background:var(--accent); color:#000; }
    .input-area { padding:15px; background:rgba(30,41,59,0.9); display:flex; gap:10px; }
    input { background:#000; border:1px solid #333; color:#fff; padding:10px; border-radius:5px; flex:1; }
</style></head>
<body>
    <div id="loader">
        <div class="visual-container"><div class="bubble b1"></div><div class="bubble b2"></div></div>
        <h2 style="margin-top:30px; letter-spacing:5px;">LOADING</h2>
    </div>

    <div id="auth-box">
        <div class="glass">
            <h2 style="color:var(--accent)">CooperChat 6.0</h2>
            <input id="un" placeholder="帳號"><br><br>
            <input id="pw" type="password" placeholder="密碼"><br><br>
            <button onclick="doL()" style="width:100%;padding:10px;background:var(--accent);border:none;border-radius:5px;font-weight:bold;">進入系統</button>
        </div>
    </div>

    <div id="main-ui">
        <div style="padding:15px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
            <b>大廳</b>
            <a href="/master-panel?u=${ADMIN_NAME}&p=${ADMIN_PASS}" style="color:red; font-size:12px; text-decoration:none;">上帝模式</a>
        </div>
        <div id="chat-box"></div>
        <div class="input-area">
            <input id="txt" placeholder="說點什麼..." onkeypress="if(event.key==='Enter')send()">
            <button onclick="send()" style="background:var(--accent); border:none; padding:10px 15px; border-radius:5px; font-weight:bold;">發送</button>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let me = null;

        // 連線成功後移除波動動畫
        socket.on('connect', () => {
            setTimeout(() => {
                const l = document.getElementById('loader');
                l.style.opacity = '0';
                setTimeout(() => { l.style.display='none'; }, 800);
            }, 1500);
        });

        function doL() {
            socket.emit('login', { u: document.getElementById('un').value, p: document.getElementById('pw').value });
        }

        socket.on('auth_ok', d => {
            me = d;
            document.getElementById('auth-box').style.display = 'none';
            document.getElementById('main-ui').style.display = 'flex';
        });

        socket.on('new_msg', m => {
            const box = document.getElementById('chat-box');
            const div = document.createElement('div');
            div.className = 'msg ' + (m.s === me.name ? 'me' : '');
            div.innerHTML = '<small>'+m.s+'</small><br>'+m.c;
            box.appendChild(div);
            box.scrollTop = box.scrollHeight;
        });

        function send() {
            const t = document.getElementById('txt');
            if(t.value.trim()){ socket.emit('msg', { c: t.value }); t.value = ''; }
        }
    </script>
</body></html>`);
});

// --- Socket.io 核心 ---
io.on('connection', (socket) => {
    socket.on('login', (d) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const u = users.find(x => x.name === d.u && x.pass === d.p);
        if (u) {
            socket.u = u;
            socket.emit('auth_ok', { name: u.name });
            socket.emit('new_msg', { s: '系統', c: '歡迎來到 CooperChat 6.0' });
        }
    });

    socket.on('msg', (p) => {
        if (!socket.u) return;
        io.emit('new_msg', { s: socket.u.name, c: p.c });
    });
});

http.listen(PORT, '0.0.0.0', () => console.log('CooperChat 6.0 Live!'));
