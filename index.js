const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    // 登入邏輯
    socket.on('login', (d) => {
        if (d.u === "CooperChen" && d.p === "11036666") {
            socket.u = { name: "CooperChen", role: "admin" };
            socket.emit('auth_ok', { name: "CooperChen" });
            return;
        }
        try {
            const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            const u = users.find(x => x.name === d.u && String(x.pass) === String(d.p));
            if (u) {
                socket.u = u;
                socket.emit('auth_ok', { name: u.name });
            } else {
                socket.emit('err', '帳號或密碼錯誤');
            }
        } catch (e) {
            socket.emit('err', '資料庫讀取失敗');
        }
    });

    // 聊天訊息邏輯 (統一使用 chat message 事件)
    socket.on('chat message', (data) => {
        if (!socket.u) return;
        io.emit('chat message', { user: socket.u.name, text: data.text });
    });
});

// 管理後台頁面
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== "CooperChen" || p !== "11036666") return res.send("驗證失敗");
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    res.send(`
        <body style="background:#000;color:#0f0;padding:20px;">
            <h3>GitHub 同步 JSON 內容</h3>
            <textarea id="t" style="width:100%;height:300px;">${JSON.stringify(users, null, 2)}</textarea>
            <button onclick="navigator.clipboard.writeText(document.getElementById('t').value);alert('已複製')">複製</button>
        </body>
    `);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
http.listen(PORT, '0.0.0.0', () => console.log('Server Ready'));
