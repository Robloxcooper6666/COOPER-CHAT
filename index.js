const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const MSGS_FILE = path.join(__dirname, 'messages.json');
const ADMIN_NAME = "CooperChen";
const ADMIN_PASS = "11036666";

// 預設配置
let channels = ["大廳", "秘密基地", "交易區", "to管理員"];
let onlineUsers = {}; // socketId -> username

// 初始化存儲檔案
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([{ name: ADMIN_NAME, pass: ADMIN_PASS, role: "admin", isMuted: false, regTime: new Date().toLocaleString() }]));
if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, JSON.stringify([]));

app.use(express.json({ limit: '100mb' }));

// ==========================
// 1. 管理員上帝後台 (修正路由與功能)
// ==========================
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('ACCESS DENIED');
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const msgs = JSON.parse(fs.readFileSync(MSGS_FILE));
    
    const fileAudit = msgs.filter(m => m.file).map(m => `
        <div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between; font-size:12px;">
            <span>[${m.room}] ${m.s}: ${m.fName}</span>
            <div>
                <a href="${m.file}" download="${m.fName}" style="color:#38bdf8">下載</a>
                <button onclick="cmd('delMsg','${m.id}')" style="color:red; background:none; border:none; cursor:pointer;">刪除</button>
            </div>
        </div>
    `).join('');

    res.send(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>God Mode</title>
    <style>
        body { background: #000; color: #fff; font-family: sans-serif; padding: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .box { background: #111; border: 1px solid #333; padding: 20px; border-radius: 10px; }
        h2 { color: #38bdf8; }
        .user-card { background: #222; padding: 10px; margin-bottom: 5px; display: flex; justify-content: space-between; border-radius: 5px; }
        button { cursor: pointer; background: #333; color: #fff; border: 1px solid #444; padding: 5px; }
        button:hover { background: #38bdf8; color: #000; }
    </style></head>
    <body>
        <h2>COOPER CHEN 上帝權限控制台</h2>
        <div class="grid">
            <div class="box">
                <h3>👤 使用者管理</h3>
                ${users.map(u => `
                    <div class="user-card">
                        <span>${u.name} ${u.isMuted ? '<b style="color:red">[禁]</b>' : ''}</span>
                        <div>
                            <button onclick="cmd('mute','${u.name}')">禁言/解禁</button>
                            <button onclick="cmd('wipe','${u.name}')">抹除言論</button>
                        </div>
                    </div>
                `).join('')}
                <hr>
                <button onclick="cmd('clearChat','')" style="width:100%; padding:10px; background:red;">清空所有歷史訊息 (警告)</button>
            </div>
            <div class="box">
                <h3>📁 檔案審核與監控</h3>
                <div style="max-height:400px; overflow-y:auto;">${fileAudit || '無檔案傳輸紀錄'}</div>
            </div>
        </div>
        <br><button onclick="location.href='/'" style="padding:10px 30px;">返回聊天室</button>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            function cmd(a, t){
                if(confirm('確認執行上帝指令？')){
                    socket.emit('god_cmd', {a, t, n:'${ADMIN_NAME}', p:'${ADMIN_PASS}'});
                    setTimeout(()=>location.reload(), 300);
                }
            }
        </script>
    </body></html>`);
});

app.get('/', (req, res) => res.send(renderHTML()));

// ==========================
// 2. Socket.IO 核心邏輯
// ==========================
io.on('connection', (socket) => {
    socket.on('login', (d) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const u = users.find(x => x.name === d.u && x.pass === d.p);
        if(u) {
            socket.u = u;
            onlineUsers[socket.id] = u.name;
            socket.emit('auth_ok', { name: u.name, channels });
            
            // 重要：上帝視角 - CooperChen 加入所有房
            if(u.name === ADMIN_NAME) channels.forEach(ch => socket.join(ch));
            else socket.join("大廳");
            
            socket.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)));
        } else { socket.emit('err', '登入失敗'); }
    });

    socket.on('join_room', (room) => {
        if(!socket.u) return;
        if(socket.u.name !== ADMIN_NAME) { // 一般人切換，管理員保持全頻監控
            socket.rooms.forEach(r => { if(r !== socket.id) socket.leave(r); });
        }
        socket.join(room);
    });

    socket.on('msg', (p) => {
        if(!socket.u) return;
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        if(users.find(x=>x.name===socket.u.name).isMuted) return socket.emit('err', '禁言中');

        const m = {
            id: "m_" + Date.now() + Math.random().toString(36).substr(2, 4),
            s: socket.u.name,
            c: p.c || "",
            file: p.file || null,
            fName: p.fName || null,
            room: p.room || "大廳",
            t: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            readBy: [socket.u.name],
            isAll: (p.c.includes('@all') && socket.u.name === ADMIN_NAME)
        };

        let h = JSON.parse(fs.readFileSync(MSGS_FILE)); h.push(m);
        fs.writeFileSync(MSGS_FILE, JSON.stringify(h.slice(-500)));
        
        io.to(m.room).emit('new_msg', m);
    });

    socket.on('mark_read', (msgId) => {
        if(!socket.u) return;
        let h = JSON.parse(fs.readFileSync(MSGS_FILE));
        let m = h.find(x => x.id === msgId);
        if(m && !m.readBy.includes(socket.u.name)) {
            m.readBy.push(socket.u.name);
            fs.writeFileSync(MSGS_FILE, JSON.stringify(h));
            io.emit('update_read', { id: msgId, readBy: m.readBy });
        }
    });

    socket.on('god_cmd', (d) => {
        if(d.n === ADMIN_NAME && d.p === ADMIN_PASS) {
            let msgs = JSON.parse(fs.readFileSync(MSGS_FILE));
            if(d.a === 'clearChat') fs.writeFileSync(MSGS_FILE, JSON.stringify([]));
            else if(d.a === 'delMsg') fs.writeFileSync(MSGS_FILE, JSON.stringify(msgs.filter(m => m.id !== d.t)));
            else if(d.a === 'wipe') fs.writeFileSync(MSGS_FILE, JSON.stringify(msgs.filter(m => m.s !== d.t)));
            else if(d.a === 'mute') {
                let users = JSON.parse(fs.readFileSync(USERS_FILE));
                let i = users.findIndex(u=>u.name===d.t);
                if(i!==-1) users[i].isMuted = !users[i].isMuted;
                fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            }
            io.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)));
        }
    });

    socket.on('disconnect', () => { delete onlineUsers[socket.id]; });
});

// ==========================
// 3. 前端介面渲染
// ==========================
function renderHTML() {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0">
    <style>
        :root { --accent: #38bdf8; }
        body { background: #0f172a; color: #fff; font-family: sans-serif; margin: 0; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
        .main { display: flex; flex: 1; overflow: hidden; }
        .sidebar { width: 120px; border-right: 1px solid rgba(255,255,255,0.1); padding: 10px; }
        .ch-btn { padding: 10px; margin-bottom: 5px; border-radius: 8px; background: rgba(255,255,255,0.05); text-align: center; cursor: pointer; font-size: 13px; }
        .ch-btn.active { background: var(--accent); color: #000; font-weight: bold; }
        #chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
        .msg { max-width: 80%; padding: 10px; border-radius: 12px; background: rgba(255,255,255,0.1); position: relative; }
        .me { align-self: flex-end; background: var(--accent); color: #000; }
        .file-card { background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; margin-top: 5px; display: block; color: var(--accent); text-decoration: none; border: 1px solid #333; }
        .read-info { font-size: 9px; opacity: 0.5; margin-top: 5px; text-align: right; }
        .input-bar { padding: 15px; display: flex; gap: 10px; }
        #search-input { width: 100%; margin-bottom: 10px; padding: 5px; background: #000; border: 1px solid #333; color: #fff; }
        @keyframes flash { 0% { outline: 0px solid red; } 50% { outline: 4px solid red; } 100% { outline: 0px solid red; } }
        .mention-all { animation: flash 0.5s 3; }
    </style></head>
    <body>
        <div id="auth" style="position:fixed;inset:0;background:#000;z-index:10000;display:flex;align-items:center;justify-content:center;">
            <div class="glass" style="padding:40px;border-radius:20px;text-align:center;">
                <h2>COOPER CHAT 6.0</h2>
                <input id="un" placeholder="帳號" style="display:block;margin:10px auto;padding:10px;border-radius:5px;">
                <input id="pw" type="password" placeholder="密碼" style="display:block;margin:10px auto;padding:10px;border-radius:5px;">
                <button onclick="doL()" style="width:100%;padding:10px;background:var(--accent);border:none;border-radius:5px;font-weight:bold;">進入系統</button>
            </div>
        </div>

        <header class="glass" style="padding:15px 20px; display:flex; justify-content:space-between;">
            <b>目前頻道: <span id="cur-ch">大廳</span></b>
            <a id="god-link" href="/master-panel?u=${ADMIN_NAME}&p=${ADMIN_PASS}" style="display:none;color:yellow;text-decoration:none;font-weight:bold;">上帝模式</a>
        </header>

        <div class="main">
            <div class="sidebar glass">
                <input id="search-input" placeholder="🔍 搜尋" oninput="filterMsgs()">
                <div id="ch-list"></div>
            </div>
            <div id="chat"></div>
        </div>

        <div class="input-bar glass">
            <label style="cursor:pointer;font-size:20px;">📁<input type="file" id="file-in" hidden onchange="upFile(this)"></label>
            <input id="txt" style="flex:1;padding:10px;border-radius:5px;border:none;" placeholder="輸入訊息... (@all 廣播)" onkeypress="if(event.key==='Enter')send()">
            <button onclick="send()" style="background:var(--accent);border:none;padding:10px 20px;border-radius:5px;font-weight:bold;">發送</button>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io(); let me = null, curRoom = "大廳";
            function doL(){ socket.emit('login', {u:document.getElementById('un').value, p:document.getElementById('pw').value}); }
            socket.on('auth_ok', d => { 
                me = d; document.getElementById('auth').style.display='none'; 
                if(me.name==='${ADMIN_NAME}') document.getElementById('god-link').style.display='block';
                renderChs();
            });

            function renderChs(){
                document.getElementById('ch-list').innerHTML = me.channels.map(c => \`<div class="ch-btn \${c===curRoom?'active':''}" onclick="swRoom('\${c}')">\${c}</div>\`).join('');
            }
            function swRoom(r){ curRoom = r; document.getElementById('cur-ch').innerText=r; document.getElementById('chat').innerHTML=''; socket.emit('join_room', r); renderChs(); }

            function upFile(el){
                const f = el.files[0]; if(!f) return;
                const reader = new FileReader();
                reader.onload = e => { socket.emit('msg', {c: '(傳送了檔案: '+f.name+')', file: e.target.result, fName: f.name, room: curRoom}); };
                reader.readAsDataURL(f);
                el.value = '';
            }

            function send(){
                const t = document.getElementById('txt');
                if(t.value.trim()){ socket.emit('msg', {c: t.value, room: curRoom}); t.value = ''; }
            }

            function filterMsgs(){
                const val = document.getElementById('search-input').value.toLowerCase();
                document.querySelectorAll('.msg').forEach(m => {
                    m.style.display = m.innerText.toLowerCase().includes(val) ? 'flex' : 'none';
                });
            }

            socket.on('new_msg', m => { 
                if(me.name==='${ADMIN_NAME}' || m.room === curRoom) { 
                    renderMsg(m); 
                    if(m.room === curRoom) socket.emit('mark_read', m.id);
                }
            });

            socket.on('history', h => { 
                document.getElementById('chat').innerHTML = '';
                h.forEach(m => { if(me.name==='${ADMIN_NAME}' || m.room === curRoom) renderMsg(m); });
            });

            socket.on('update_read', d => {
                const el = document.getElementById('read-'+d.id);
                if(el){
                    if(me.name === '${ADMIN_NAME}') el.innerText = '✔ 已讀: ' + d.readBy.join(', ');
                    else el.innerText = '✔ 已讀 ' + d.readBy.length;
                }
            });

            function renderMsg(m){
                const chat = document.getElementById('chat');
                const isMe = m.s === me.name;
                const d = document.createElement('div');
                d.className = 'msg ' + (isMe?'me':'') + (m.isAll?' mention-all':'');
                
                let tag = (me.name==='${ADMIN_NAME}' && m.room !== curRoom) ? \`<small style="color:orange;">[\${m.room}]</small> \` : '';
                let content = m.file ? \`<a href="\${m.file}" download="\${m.fName}" class="file-card">📄 \${m.fName}</a>\` : m.c;

                d.innerHTML = \`
                    <div style="font-size:10px;opacity:0.6;">\${tag}<b>\${m.s}</b></div>
                    <div>\${content}</div>
                    <div id="read-\${m.id}" class="read-info">✔ \${me.name==='${ADMIN_NAME}' ? '已讀: '+m.readBy.join(', ') : '已讀 '+m.readBy.length}</div>
                \`;
                chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
            }
        </script>
    </body></html>`;
}

http.listen(PORT, '0.0.0.0', () => console.log('上帝聊天室 6.0 運行中: http://localhost:3000'));
