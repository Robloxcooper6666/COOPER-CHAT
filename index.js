const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// 【核心修正】直接指向根目錄，確保讀到你 GitHub 上的檔案
const USERS_FILE = path.join(__dirname, 'users.json');
const MSGS_FILE = path.join(__dirname, 'messages.json');

const ADMIN_NAME = "CooperChen";
const ADMIN_PASS = "11036666";

// 伺服器啟動檢查
console.log("正在檢查資料庫路徑:", USERS_FILE);
if (fs.existsSync(USERS_FILE)) {
    console.log("✅ 成功找到 users.json");
} else {
    console.log("❌ 找不到 users.json，建立緊急救援檔案");
    fs.writeFileSync(USERS_FILE, JSON.stringify([{ "name": "CooperChen", "pass": "11036666", "role": "admin" }], null, 2));
}

if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, JSON.stringify([]));

app.use(express.json({ limit: '50mb' }));

// ---------------------------
// 1. 登入與 Socket 邏輯 (強化版)
// ---------------------------
io.on('connection', (socket) => {
    socket.on('login', (d) => {
        try {
            // 每次登入都重新讀取檔案，確保同步
            const rawData = fs.readFileSync(USERS_FILE, 'utf8');
            const users = JSON.parse(rawData);
            
            // 尋找帳號 (不分大小寫)
            const u = users.find(x => x.name.toLowerCase() === d.u.toLowerCase() && String(x.pass) === String(d.p));
            
            if(u) {
                console.log(`👤 使用者 ${u.name} 登入成功`);
                socket.u = u;
                socket.emit('auth_ok', { name: u.name, channels: ["大廳", "秘密基地", "交易區", "to管理員"] });
                socket.join("大廳");
                if(u.role === 'admin') socket.join("to管理員");
                
                const msgs = JSON.parse(fs.readFileSync(MSGS_FILE, 'utf8'));
                socket.emit('history', msgs);
            } else {
                console.log(`❌ 登入失敗嘗試: 帳號=${d.u}, 密碼=${d.p}`);
                socket.emit('err', '帳號或密碼錯誤');
            }
        } catch(e) {
            console.error("⛔ 讀取 users.json 出錯:", e);
            socket.emit('err', '系統錯誤: 無法讀取帳號庫');
        }
    });

    socket.on('msg', (p) => {
        if(!socket.u) return;
        const m = {
            id: "m_" + Date.now(),
            s: socket.u.name,
            c: p.c || "",
            room: p.room || "大廳",
            t: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            readBy: [socket.u.name]
        };
        try {
            let h = JSON.parse(fs.readFileSync(MSGS_FILE, 'utf8'));
            h.push(m);
            fs.writeFileSync(MSGS_FILE, JSON.stringify(h.slice(-100)));
            io.to(m.room).emit('new_msg', m);
        } catch(e) {}
    });

    socket.on('god_cmd', (d) => {
        if(d.n === ADMIN_NAME && d.p === ADMIN_PASS) {
            let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            if(d.a === 'addUser') {
                users.push({ name: d.t.name, pass: d.t.pass, role: "user", isMuted: false });
            } else if(d.a === 'delUser') {
                users = users.filter(u => u.name !== d.t);
            }
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        }
    });
});

// ---------------------------
// 2. 路由與管理介面
// ---------------------------
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.send("驗證失敗");
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    res.send(`
        <html><body style="background:#000;color:#fff;font-family:sans-serif;padding:20px;">
        <h2>上帝控制台</h2>
        <textarea id="out" style="width:100%;height:200px;background:#111;color:#0f0;">${JSON.stringify(users, null, 2)}</textarea>
        <button onclick="navigator.clipboard.writeText(document.getElementById('out').value);alert('已複製')">複製 JSON 貼回 GitHub</button>
        <p>修改完後，請記得回 GitHub 更新 users.json 檔案。</p>
        </body></html>
    `);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

http.listen(PORT, '0.0.0.0', () => console.log('服務器運行中，端口:' + PORT));
