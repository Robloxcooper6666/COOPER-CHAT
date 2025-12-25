const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const fs = require('fs');
const path = require('path');

// ==========================
// 1. 基本配置 (請修改密碼)
// ==========================
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MSGS_FILE = path.join(DATA_DIR, 'messages.json');
const ADMIN_NAME = "CooperChen";
const ADMIN_PASS = "11036666"; // <--- 建議改掉，保持與 GitHub users.json 一致

// 初始化儲存空間
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([
        { "name": "CooperChen", "pass": "11036666", "role": "admin" },
        { "name": "Patrick", "pass": "104314", "role": "user", "isMuted": false },
        { "name": "Judy", "pass": "0314", "role": "user" },
        { "name": "Christina", "pass": "1019", "role": "user" },
        { "name": "Angela", "pass": "1019", "role": "user" }
    ], null, 2));
}
if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, JSON.stringify([]));

app.use(express.json({ limit: '50mb' }));

// ==========================
// 2. 上帝後台渲染
// ==========================
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('ACCESS DENIED');
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const githubJson = JSON.stringify(users, null, 2);

    res.send(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>CooperChat Admin</title>
    <style>
        body { background: #0f172a; color: #fff; font-family: sans-serif; padding: 20px; }
        .box { background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
        textarea { width: 100%; height: 250px; background: #020617; color: #22c55e; border: 1px solid #475569; padding: 15px; font-family: monospace; border-radius: 8px; }
        .btn { cursor: pointer; padding: 10px 20px; border-radius: 6px; border: none; font-weight: bold; margin-top: 10px; }
        .btn-copy { background: #38bdf8; color: #000; width: 100%; }
        .btn-add { background: #22c55e; color: #fff; }
        .user-item { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #334155; }
        input { padding: 10px; background: #000; color: #fff; border: 1px solid #334155; border-radius: 4px; }
    </style></head>
    <body>
        <h2>🛠 上帝控制台 (GitHub 同步版)</h2>
        <div class="box">
            <h3>新增帳號</h3>
            <input id="nn" placeholder="姓名"> <input id="np" placeholder="密碼">
            <button class="btn btn-add" onclick="add()">新增到清單</button>
            <div style="margin-top:15px;">
                ${users.map(x => `<div class="user-item"><span>${x.name} (${x.role})</span> <button onclick="del('${x.name}')" style="background:red; color:#fff; border:none; border-radius:4px;">刪除</button></div>`).join('')}
            </div>
        </div>
        <div class="box">
            <h3>📋 複製並更新到 GitHub (users.json)</h3>
            <textarea id="output" readonly>${githubJson}</textarea>
            <button class="btn btn-copy" onclick="copy()">一鍵複製 JSON</button>
            <p id="tip" style="color:yellow; display:none; text-align:center;">✅ 已複製！請去 GitHub 貼上並 Commit。</p>
        </div>
        <button class="btn" onclick="location.href='/'">返回聊天室</button>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            function add(){
                const name = document.getElementById('nn').value;
                const pass = document.getElementById('np').value;
                if(!name || !pass) return alert('必填');
                socket.emit('god_cmd', {a:'addUser', t:{name, pass}, n:'${u}', p:'${p}'});
                setTimeout(()=>location.reload(), 300);
            }
            function del(name){
                if(confirm('刪除 '+name+'?')){
                    socket.emit('god_cmd', {a:'delUser', t:name, n:'${u}', p:'${p}'});
                    setTimeout(()=>location.reload(), 300);
                }
            }
            function copy(){
                document.getElementById('output').select();
                document.execCommand('copy');
                document.getElementById('tip').style.display='block';
            }
        </script>
    </body></html>`);
});

// ==========================
// 3. 核心 Socket 邏輯
// ==========================
let channels = ["大廳", "秘密基地", "交易區", "to管理員"];

io.on('connection', (socket) => {
    socket.on('login', (d) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const u = users.find(x => x.name === d.u && x.pass === d.p);
        if(u) {
            socket.u = u;
            socket.emit('auth_ok', { name: u.name, channels });
            if(u.name === ADMIN_NAME) channels.forEach(c => socket.join(c));
            else socket.join("大廳");
            socket.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)));
        } else { socket.emit('err', '登入失敗'); }
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
        let h = JSON.parse(fs.readFileSync(MSGS_FILE)); h.push(m);
        fs.writeFileSync(MSGS_FILE, JSON.stringify(h.slice(-200)));
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
            io.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)));
        }
    });
});

// 前端主介面 (簡化版 render)
app.get('/', (req, res) => {
    res.send(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')); // 建議把 HTML 抽出來或放進變數
});

// 直接嵌入 HTML 供你無腦測試
const renderHTML = () => `...內容如你原有的 HTML...`; 

http.listen(PORT, '0.0.0.0', () => console.log('運作中: ' + PORT));
