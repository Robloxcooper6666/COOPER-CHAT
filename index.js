const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log("有人連線了，ID:", socket.id);

    socket.on('login', (d) => {
        console.log("收到登入請求:", d.u);
        
        // 暴力破解級別：直接驗證
        if (d.u === "CooperChen" && d.p === "11036666") {
            console.log("CooperChen 驗證通過");
            socket.emit('auth_ok', { name: "CooperChen", channels: ["大廳", "秘密基地"] });
            return;
        }

        // 讀取檔案驗證其他人
        try {
            const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            const u = users.find(x => x.name === d.u && String(x.pass) === String(d.p));
            if (u) {
                socket.emit('auth_ok', { name: u.name, channels: ["大廳"] });
                return;
            }
        } catch (e) { console.log("檔案讀取失敗"); }

        socket.emit('err', '登入失敗，請檢查帳號密碼');
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

http.listen(PORT, '0.0.0.0', () => console.log('伺服器啟動在端口: ' + PORT));
