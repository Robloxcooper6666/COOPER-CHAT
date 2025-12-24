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

let channels = ["大廳", "秘密基地", "交易區", "to管理員"];

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([{ name: ADMIN_NAME, pass: ADMIN_PASS, role: "admin" }], null, 2));
if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, JSON.stringify([]));

app.use(express.json({ limit: '100mb' }));

// 1. 上帝控制台 (同步帳號用)
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('ACCESS DENIED');
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    res.send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
        <style>body{background:#000;color:#0f0;font-family:monospace;padding:20px;}.box{border:1px solid #0f0;padding:15px;margin-bottom:20px;}input{background:#111;border:1px solid #0f0;color:#0f0;padding:5px;margin:5px;}button{background:#0f0;color:#000;border:none;padding:10px;font-weight:bold;}textarea{width:100%;height:150px;background:#111;color:#0f0;border:1px solid #0f0;}</style></head>
        <body>
            <h2>COOPER 控制台</h2>
            <div class="box"><h3>新增帳號</h3>帳號:<input id="nu"> 密碼:<input id="np"><button onclick="addUser()">新增</button></div>
            <div class="box"><h3>GitHub 同步碼</h3><textarea id="syncBox" readonly>${JSON.stringify(users, null, 2)}</textarea><br><br><button onclick="copyCode()">一鍵複製並去 GitHub 貼上</button></div>
            <button onclick="location.href='/'">返回聊天室</button>
            <script>
                async function addUser(){const u=document.getElementById('nu').value,p=document.getElementById('np').value;if(!u||!p)return;await fetch('/api/add-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u,p,adminU:'${ADMIN_NAME}',adminP:'${ADMIN_PASS}'})});location.reload();}
                function copyCode(){const t=document.getElementById('syncBox');t.select();document.execCommand('copy');alert('已複製！請去 GitHub 修改 users.json');}
            </script>
        </body></html>
    `);
});

// 2. 新增帳號 API
app.post('/api/add-user', (req, res) => {
    const { u, p, adminU, adminP } = req.body;
    if (adminU !== ADMIN_NAME || adminP !== ADMIN_PASS) return res.sendStatus(403);
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    users.push({ name: u, pass: p, role: "user" });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.sendStatus(200);
});

// 3. 聊天室主頁 (直接渲染 6.0 介面)
app.get('/', (req, res) => {
    res.send(renderHTML()); 
});

// Socket 邏輯 (歷史訊息、傳檔案)
io.on('connection', (socket) => {
    socket.on('login', (d) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const u = users.find(x => x.name === d.u && x.pass === d.p);
        if(u) {
            socket.u = u;
            socket.emit('auth_ok', { name: u.name, channels });
            if(u.name === ADMIN_NAME) channels.forEach(ch => socket.join(ch));
            else socket.join("大廳");
            socket.emit('history', JSON.parse(fs.readFileSync(MSGS_FILE)));
        } else { socket.emit('err', '登入失敗'); }
    });
    socket.on('msg', (p) => {
        if(!socket.u) return;
        const m = { id: "m_"+Date.now(), s: socket.u.name, c: p.c, file: p.file, fName: p.fName, room: p.room || "大廳", t: new Date().toLocaleTimeString(), readBy: [socket.u.name] };
        let h = JSON.parse(fs.readFileSync(MSGS_FILE)); h.push(m);
        fs.writeFileSync(MSGS_FILE, JSON.stringify(h.slice(-500)));
        io.to(m.room).emit('new_msg', m);
    });
});

// 這裡放入你最愛的 6.0 HTML 程式碼
function renderHTML() {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>:root{--accent:#38bdf8;}body{background:#0f172a;color:#fff;font-family:sans-serif;margin:0;height:100vh;display:flex;flex-direction:column;}.glass{background:rgba(30,41,59,0.7);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);}.main{display:flex;flex:1;overflow:hidden;}#chat{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:10px;}.msg{max-width:80%;padding:10px;border-radius:12px;background:rgba(255,255,255,0.1);}.me{align-self:flex-end;background:var(--accent);color:#000;}.input-bar{padding:15px;display:flex;gap:10px;}</style></head><body>
    <div id="auth" style="position:fixed;inset:0;background:#000;z-index:10000;display:flex;align-items:center;justify-content:center;"><div class="glass" style="padding:40px;border-radius:20px;text-align:center;"><h2>COOPER CHAT 6.0</h2><input id="un" placeholder="帳號" style="display:block;margin:10px auto;padding:10px;"><input id="pw" type="password" placeholder="密碼" style="display:block;margin:10px auto;padding:10px;"><button onclick="doL()" style="width:100%;padding:10px;background:var(--accent);border:none;border-radius:5px;font-weight:bold;">進入系統</button></div></div>
    <header class="glass" style="padding:15px 20px; display:flex; justify-content:space-between;"><b>頻道: <span id="cur-ch">大廳</span></b> <a href="/master-panel?u=${ADMIN_NAME}&p=${ADMIN_PASS}" style="color:red;text-decoration:none;font-size:12px;">上帝模式</a></header>
    <div class="main"><div id="chat"></div></div>
    <div class="input-bar glass"><input id="txt" style="flex:1;padding:10px;border-radius:5px;border:none;" placeholder="輸入訊息..." onkeypress="if(event.key==='Enter')send()"><button onclick="send()" style="background:var(--accent);border:none;padding:10px 20px;border-radius:5px;font-weight:bold;">發送</button></div>
    <script src="/socket.io/socket.io.js"></script><script>const socket=io();let me=null,curRoom="大廳";function doL(){socket.emit('login',{u:document.getElementById('un').value,p:document.getElementById('pw').value});}socket.on('auth_ok',d=>{me=d;document.getElementById('auth').style.display='none';});socket.on('new_msg',m=>{if(m.room===curRoom){const chat=document.getElementById('chat');const div=document.createElement('div');div.className='msg '+(m.s===me.name?'me':'');div.innerHTML='<small>'+m.s+'</small><br>'+m.c;chat.appendChild(div);chat.scrollTop=chat.scrollHeight;}});function send(){const t=document.getElementById('txt');if(t.value.trim()){socket.emit('msg',{c:t.value,room:curRoom});t.value='';}}</script></body></html>`;
}

http.listen(PORT, '0.0.0.0', () => console.log('CooperChat 6.0 Live'));
