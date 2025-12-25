const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const MSGS_FILE = path.join(__dirname, 'messages.json');

// ==========================
// 無腦登入設定
// ==========================
const ADMIN_NAME = "CooperChen";
const ADMIN_PASS = "11036666";

app.use(express.json());

io.on('connection', (socket) => {
    socket.on('login', (d) => {
        // 第一優先：直接比對寫死的管理員帳號 (這絕對會過)
        if (d.u === ADMIN_NAME && d.p === ADMIN_PASS) {
            console.log("✅ 管理員暴力登入成功");
            socket.u = { name: ADMIN_NAME, role: "admin" };
            socket.emit('auth_ok', { name: ADMIN_NAME, channels: ["大廳", "秘密基地", "交易區", "to管理員"] });
            socket.join("大廳");
            socket.join("to管理員");
            return;
        }

        // 第二優先：讀取 users.json 供其他成員登入
        try {
            if (fs.existsSync(USERS_FILE)) {
                const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
                const u = users.find(x => x.name === d.u && String(x.pass) === String(d.p));
                if (u) {
                    socket.u = u;
                    socket.emit('auth_ok', { name: u.name, channels: ["大廳", "秘密基地", "交易區"] });
                    socket.join("大廳");
                    return;
                }
            }
        } catch (e) { console.log("讀取資料庫錯誤"); }

        // 全部失敗
        socket.emit('err', '登入失敗，請檢查帳號密碼');
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
        io.to(m.room).emit('new_msg', m);
    });
});

// 管理員專用後台路徑：https://你的網址/master-panel?u=CooperChen&p=11036666
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send("密碼錯誤");
    
    let users = [];
    if (fs.existsSync(USERS_FILE)) users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    
    res.send(`
        <body style="background:#000;color:#0f0;padding:20px;">
            <h2>上帝控制台 - 帳號清單</h2>
            <textarea id="t" style="width:100%;height:300px;background:#111;color:#0f0;">${JSON.stringify(users, null, 2)}</textarea>
            <br><br>
            <button style="padding:10px;" onclick="navigator.clipboard.writeText(document.getElementById('t').value);alert('已複製')">複製 JSON</button>
            <p style="color:white;">複製後，請去 GitHub 的 users.json 貼上並存檔。</p>
        </body>
    `);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

http.listen(PORT, '0.0.0.0', () => console.log('Cooper Chat Ready!'));
