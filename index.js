const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

// 公網伺服器自動分配 PORT，預設 3000
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const MSGS_FILE = path.join(__dirname, 'messages.json');
const ADMIN_NAME = "CooperChen";
const ADMIN_PASS = "11036666";

// 預設配置與在線緩存
let channels = ["大廳", "秘密基地", "交易區", "管理專線"];
let onlineUsers = {}; // socketId -> {name, ip}

// 初始化存儲檔案
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([{ name: ADMIN_NAME, pass: ADMIN_PASS, role: "admin", isMuted: false, regTime: new Date().toLocaleString() }], null, 2));
if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, JSON.stringify([]));

app.use(express.json({ limit: '100mb' }));

// ==========================
// 1. 管理員上帝後台 (功能增強版)
// ==========================
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('ACCESS DENIED');
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const msgs = JSON.parse(fs.readFileSync(MSGS_FILE));
    
    // 檔案審核清單
    const fileAudit = msgs.filter(m => m.file).reverse().map(m => `
        <div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between; font-size:12px;">
            <span>[${m.room}] <b>${m.s}</b>: ${m.fName}</span>
            <div>
                <a href="${m.file}" download="${m.fName}" style="color:#38bdf8; text-decoration:none; margin-right:10px;">下載</a>
                <button onclick="cmd('delMsg','${m.id}')" style="color:red; background:none; border:none; cursor:pointer;">刪除</button>
            </div>
        </div>
    `).join('');

    // 在線 IP 清單
    const onlineList = Object.values(onlineUsers).map(u => `<li>${u.name} <small style="color:#666">(${u.ip})</small></li>`).join('');

    res.send(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>God Mode Console</title>
    <style>
        body { background: #000; color: #fff; font-family: monospace; padding: 20px; line-height:1.6; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .box { background: #0a0a0a; border: 1px solid #145656; padding: 20px; border-radius: 5px; }
        h2, h3 { color: #4ecdc4; text-transform: uppercase; border-bottom: 1px solid #145656; padding-bottom:10px; }
        .user-card { background: #111; padding: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #222; }
        button { cursor: pointer; background: #145656; color: #fff; border: none; padding: 6px 12px; font-family: monospace; }
        button:hover { background: #4ecdc4; color: #000; }
        .danger { background: #451a1a; }
        .danger:hover { background: red; }
    </style></head>
    <body>
        <h2>COOPER_GOD_CONSOLE v7.0</h2>
        <div class="grid">
            <div class="box">
                <h3>👤 USER_MGMT</h3>
                ${users.map(u => `
                    <div class="user-card">
                        <span>${u.name} ${u.isMuted ? '<b style="color:red">[MUTED]</b>' : ''}</span>
                        <div>
                            <button onclick="cmd('mute','${u.name}')">MUTE/UNMUTE</button>
                            <button onclick="cmd('wipe','${u.name}')" class="danger">WIPE_LOGS</button>
                        </div>
                    </div>
                `).join('')}
                <hr style="border-color:#145656">
                <button onclick="cmd('clearChat','')" class="danger" style="width:100%; padding:10px;">PURGE_ALL_HISTORY</button>
                <h3>🌐 CURRENTLY_ONLINE</h3>
                <ul>${onlineList || 'None'}</ul>
            </div>
            <div class="box">
                <h3>📁 FILE_AUDIT_LOG</h3>
                <div style="max-height:600px; overflow-y:auto;">${fileAudit || 'NO FILES TRANSMITTED'}</div>
            </div>
        </div>
        <br><button onclick="location.href='/'" style="padding:10px 40px; border:1px solid #4ecdc4">BACK_TO_CHAT</button>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            function cmd(a, t){
                if(confirm('CONFIRM GOD COMMAND: ' + a + '?')){
                    socket.emit('god_cmd', {a, t, n:'${ADMIN_NAME}', p:'${ADMIN_PASS}'});
                    setTimeout(()=>location.reload(), 500);
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
    // 抓取真實 IP
    const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

    socket.on('login', (d) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const u = users.find(x => x.name === d.u && x.pass === d.p);
        if(u) {
            socket.u = u;
            onlineUsers[socket.id] = { name: u.name, ip: ip };
            socket.emit('auth_ok', { name: u.name, channels });
            
            // 上帝視角監控所有頻道
            if(u.name === ADMIN_NAME) channels.forEach(ch => socket.join(ch));
            else socket.join("大廳");
            
            socket.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)));
        } else { socket.emit('err', 'Invalid Access Code'); }
    });

    socket.on('join_room', (room) => {
        if(!socket.u) return;
        // 一般用戶離開舊房進入新房，管理員保持多頻監控
        if(socket.u.name !== ADMIN_NAME) {
            socket.rooms.forEach(r => { if(r !== socket.id) socket.leave(r); });
        }
        socket.join(room);
    });

    socket.on('msg', (p) => {
        if(!socket.u) return;
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        if(users.find(x=>x.name===socket.u.name).isMuted) return socket.emit('err', 'System: You are currently muted.');

        const m = {
            id: "m_" + Date.now() + Math.random().toString(36).substr(2, 4),
            s: socket.u.name,
            c: p.c || "",
            file: p.file || null,
            fName: p.fName || null,
            room: p.room || "大廳",
            t: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            readBy: [socket.u.name],
            isAll: (p.c.includes('@all') && socket.u.name === ADMIN_NAME) // 只有上帝能發廣播
        };

        let h = JSON.parse(fs.readFileSync(MSGS_FILE)); 
        h.push(m);
        fs.writeFileSync(MSGS_FILE, JSON.stringify(h.slice(-500))); // 保持 500 條紀錄
        
        // 廣播或頻道發送
        if(m.isAll) io.emit('new_msg', m);
        else io.to(m.room).emit('new_msg', m);
    });

    socket.on('mark_read', (msgId) => {
        if(!socket.u) return;
        let h = JSON.parse(fs.readFileSync(MSGS_FILE));
        let m = h.find(x => x.id === msgId);
        if(m && !m.readBy.includes(socket.u.name)) {
            m.readBy.push(socket.u.name);
            fs.writeFileSync(MSGS_FILE, JSON.stringify(h));
            io.emit('update_read', { id: msgId, readBy: m.readBy }); // 更新已讀狀態
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
// 3. 前端介面渲染 (深青色版)
// ==========================
function renderHTML() {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0">
    <style>
        :root { --accent: #4ecdc4; --deep: #145656; }
        body { background: #0a1a1a; color: #a8dadc; font-family: monospace; margin: 0; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        .glass { background: rgba(20, 86, 86, 0.1); backdrop-filter: blur(10px); border: 1px solid var(--deep); }
        .main { display: flex; flex: 1; overflow: hidden; }
        .sidebar { width: 140px; border-right: 1px solid var(--deep); padding: 10px; }
        .ch-btn { padding: 12px; margin-bottom: 8px; border-radius: 4px; background: rgba(20,86,86,0.2); text-align: center; cursor: pointer; font-size: 13px; color: var(--accent); border: 1px solid transparent; }
        .ch-btn.active { border-color: var(--accent); background: var(--deep); color: #fff; font-weight: bold; }
        #chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
        .msg { max-width: 85%; padding: 12px; border-radius: 4px; background: rgba(20,86,86,0.3); border-left: 2px solid var(--deep); position: relative; }
        .me { align-self: flex-end; border-left: none; border-right: 2px solid var(--accent); color: #fff; }
        .file-card { background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; margin-top: 8px; display: block; color: var(--accent); text-decoration: none; border: 1px solid var(--deep); }
        .read-info { font-size: 10px; opacity: 0.5; margin-top: 5px; }
        .input-bar { padding: 20px; display: flex; gap: 12px; }
        #search-input { width: 100%; margin-bottom: 10px; padding: 8px; background: #000; border: 1px solid var(--deep); color: var(--accent); font-family: monospace; }
        #txt { flex:1; padding:12px; border:1px solid var(--deep); background:#000; color:#fff; font-family:monospace; }
        @keyframes flash { 0% { outline: 0px solid red; } 50% { outline: 4px solid red; } 100% { outline: 0px solid red; } }
        .mention-all { animation: flash 0.5s 3; border: 1px solid red; }
    </style></head>
    <body>
        <div id="auth" style="position:fixed;inset:0;background:#000;z-index:10000;display:flex;align-items:center;justify-content:center;">
            <div class="glass" style="padding:40px;border-radius:5px;text-align:center; border: 2px solid var(--deep);">
                <h2 style="color:var(--accent); letter-spacing:4px;">COOPER_SECURE_LINK</h2>
                <input id="un" placeholder="ID" style="display:block;margin:15px auto;padding:12px; background:#000; border:1px solid var(--deep); color:#fff; text-align:center;">
                <input id="pw" type="password" placeholder="KEY" style="display:block;margin:15px auto;padding:12px; background:#000; border:1px solid var(--deep); color:#fff; text-align:center;">
                <button onclick="doL()" style="width:100%;padding:12px;background:var(--deep);color:#fff;border:none;cursor:pointer;font-weight:bold;">ACCESS_SYSTEM</button>
            </div>
        </div>

        <header class="glass" style="padding:15px 25px; display:flex; justify-content:space-between; align-items:center;">
            <b>CHANNEL_LINK: <span id="cur-ch" style="color:var(--accent)">大廳</span></b>
            <a id="god-link" href="/master-panel?u=${ADMIN_NAME}&p=${ADMIN_PASS}" style="display:none;color:red;text-decoration:none;font-weight:bold; border: 1px solid red; padding: 4px 10px;">GOD_CONSOLE</a>
        </header>

        <div class="main">
            <div class="sidebar glass">
                <input id="search-input" placeholder="🔍 SEARCH" oninput="filterMsgs()">
                <div id="ch-list"></div>
            </div>
            <div id="chat"></div>
        </div>

        <div class="input-bar glass">
            <label style="cursor:pointer;font-size:24px;" title="UPLOAD">📁<input type="file" id="file-in" hidden onchange="upFile(this)"></label>
            <input id="txt" placeholder="TYPE_MSG_OR_CMD..." onkeypress="if(event.key==='Enter')send()">
            <button onclick="send()" style="background:var(--deep);color:#fff;border:none;padding:10px 30px;cursor:pointer;font-weight:bold;">SEND</button>
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
                reader.onload = e => { socket.emit('msg', {c: '(SENT_FILE: '+f.name+')', file: e.target.result, fName: f.name, room: curRoom}); };
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
                if(me.name==='${ADMIN_NAME}' || m.room === curRoom || m.isAll) { 
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
                    if(me.name === '${ADMIN_NAME}') el.innerText = '✔ READBY: ' + d.readBy.join(', ');
                    else el.innerText = '✔ READ ' + d.readBy.length;
                }
            });

            function renderMsg(m){
                const chat = document.getElementById('chat');
                const isMe = m.s === me.name;
                const d = document.createElement('div');
                d.className = 'msg ' + (isMe?'me':'') + (m.isAll?' mention-all':'');
                
                let tag = (me.name==='${ADMIN_NAME}' && m.room !== curRoom) ? \`<small style=\"color:orange;\">[\${m.room}]</small> \` : '';
                let content = m.file ? \`<a href=\"\${m.file}\" download=\"\${m.fName}\" class=\"file-card\">📄 \${m.fName}</a>\` : m.c;

                d.innerHTML = \`
                    <div style=\"font-size:10px;opacity:0.6;\">\${tag}<b>\${m.s}</b> @ \${m.t}</div>
                    <div style=\"padding-top:5px;\">\${content}</div>
                    <div id=\"read-\${m.id}\" class=\"read-info\">✔ \${me.name==='${ADMIN_NAME}' ? 'READBY: '+m.readBy.join(', ') : 'READ '+m.readBy.length}</div>
                \`;
                chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
            }
        </script>
    </body></html>`;
}

http.listen(PORT, '0.0.0.0', () => console.log('Cooper_Security_Network_v7.0_Ready'));
