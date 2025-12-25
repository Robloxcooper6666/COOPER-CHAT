const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket', 'polling'] // 強制支援兩種傳輸模式
});
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.static(__dirname)); // 確保能讀取到 index.html
app.use(express.json());

io.on('connection', (socket) => {
    console.log("⚡ 有人連線了:", socket.id);

    socket.on('login', (d) => {
        console.log("嘗試登入:", d.u);
        
        // 暴力破解級別的檢查：直接在程式碼裡寫死
        if (d.u === "CooperChen" && d.p === "11036666") {
            socket.u = { name: "CooperChen", role: "admin" };
            socket.emit('auth_ok', { name: "CooperChen", channels: ["大廳", "秘密基地"] });
            console.log("✅ CooperChen 登入成功");
            return;
        }

        // 讀取檔案
        try {
            if (fs.existsSync(USERS_FILE)) {
                const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
                const u = users.find(x => x.name === d.u && String(x.pass) === String(d.p));
                if (u) {
                    socket.u = u;
                    socket.emit('auth_ok', { name: u.name, channels: ["大廳"] });
                    return;
                }
            }
        } catch (e) { console.log("讀取錯誤"); }

        socket.emit('err', '登入失敗，請檢查帳號密碼');
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

http.listen(PORT, '0.0.0.0', () => console.log('SERVER START ON ' + PORT));
