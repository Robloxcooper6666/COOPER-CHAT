const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const fs = require('fs');
const path = require('path');

// ==========================
// 1. 路徑修正：直接讀取根目錄檔案
// ==========================
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const MSGS_FILE = path.join(__dirname, 'messages.json');
const ADMIN_NAME = "CooperChen";
const ADMIN_PASS = "11036666";

// 檢查檔案是否存在，不存在則建立(防止當機)
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([{ "name": "CooperChen", "pass": "11036666", "role": "admin" }], null, 2));
}
if (!fs.existsSync(MSGS_FILE)) {
    fs.writeFileSync(MSGS_FILE, JSON.stringify([]));
}

app.use(express.json({ limit: '50mb' }));

// ==========================
// 2. 上帝後台渲染 (修正版)
// ==========================
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('管理員驗證失敗');
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const githubJson = JSON.stringify(users, null, 2);

    res.send(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>Admin Console</title>
    <style>
        body { background: #0f172a; color: #fff; font-family: sans-serif; padding: 20px; }
        .box { background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
        textarea { width: 100%; height: 250px; background: #000; color: #22c55e; padding: 10px; font-family: monospace; border-radius: 8px; }
        .btn { cursor: pointer; padding: 10px 20px; border-radius: 6px; border: none; font-weight: bold; margin-top: 10px; }
        .btn-copy { background: #38bdf8; color: #000; width: 100%; }
        .user-item { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #334155; }
        input { padding: 8px; margin-right: 5px; background: #000; color: #fff; border: 1px solid #334155; }
    </style></head>
    <body>
        <h2>🛠 上帝控制台</h2>
        <div class="box">
            <h3>新增帳號</h3>
            <input id="nn" placeholder="姓名"> <input id="np" placeholder="密碼">
            <button onclick="add()" style="background:#22c55e; color:white; padding:8px;">新增</button>
            <div style="margin-top:15px;">${users.map(x => `<div class="user-item"><span>${x.name} (${x.role})</span><button onclick="del('${x.name}')" style="background:red; color:white; border:none;">刪除</button></div>`).join('')}</div>
        </div>
        <div class="box">
            <h3>📋 貼回 GitHub 的內容</h3>
            <textarea id="output" readonly>${githubJson}</textarea>
            <button class="btn btn-copy" onclick="copy()">複製 JSON 內容</button>
        </div>
        <button class="btn" onclick="location.href='/'">返回聊天室</button>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            function add(){
                const name = document.getElementById('nn').value;
                const pass = document.getElementById('np').value;
                if(!name || !pass) return alert('必填');
                socket.emit('god_cmd', {a:'addUser', t:{name, pass}, n:'${ADMIN_NAME}', p:'${ADMIN_PASS}'});
                setTimeout(()=>location.reload(), 300);
            }
            function del(n){
                if(confirm('刪除 '+n+'?')){
                    socket.emit('god_cmd', {a:'delUser', t:n, n:'${ADMIN_NAME}', p:'${ADMIN_PASS}'});
                    setTimeout(()=>location.reload(), 300);
                }
            }
            function copy(){
                document.getElementById('output').select();
                document.execCommand('copy');
                alert('已複製！請去 GitHub 修改 users.json');
            }
        </script>
    </body></html>`);
});

// ==========================
// 3. Socket 核心邏輯 (與登入)
// ==========================
let channels = ["大廳", "秘密基地", "交易區", "to管理員"];

io.on('connection', (socket) => {
    socket.on('login', (d) => {
        try {
            const users = JSON.parse(fs.readFileSync(USERS_FILE));
            const u = users.find(x => x.name === d.u && x.pass === d.p);
            if(u) {
                socket.u = u;
                socket.emit('auth_ok', { name: u.name, channels });
                if(u.name === ADMIN_NAME) channels.forEach(c => socket.join(c));
                else socket.join("大廳");
                socket.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)));
            } else {
                socket.emit('err', '帳號或密碼錯誤');
            }
        } catch(e) {
            socket.emit('err', '資料庫讀取失敗');
        }
    });

    socket.on('msg', (p) => {
        if(!socket.u) return;
        const m = {
            id: "m_" + Date.now(),
            s: socket.u.name,
            c: p.c || "",
            file: p.file || null,
            fName: p.fName || null,
            room: p.room || "大廳",
            t: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            readBy: [socket.u.name]
        };
        let h = JSON.parse(fs.readFileSync(MSGS_FILE));
        h.push(m);
        fs.writeFileSync(MSGS_FILE, JSON.stringify(h.slice(-100)));
        io.to(m.room).emit('new_msg', m);
    });

    socket.on('god_cmd', (d) => {
        if(d.n === ADMIN_NAME && d.p === ADMIN_PASS) {
            let users = JSON.parse(fs.readFileSync(USERS_FILE));
            if(d.a === 'addUser') {
                users.push({ name: d.t.name, pass: d.t.pass, role: "user", isMuted: false });
            } else if(d.a === 'delUser') {
                users = users.filter(u => u.name !== d.t);
            }
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        }
    });
});

// 前端渲染邏輯 (直接沿用你原本 index.html 的邏輯，或由 server 發送)
app.get('/', (req, res) => {
    // 這裡會尋找你 GitHub 根目錄的 index.html
    res.sendFile(path.join(__dirname, 'index.html'));
});

http.listen(PORT, '0.0.0.0', () => console.log('Server is running on port ' + PORT));
