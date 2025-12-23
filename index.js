const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

// 【關鍵設定】Render 會自動分配 Port，若抓不到則預設 10000
const PORT = process.env.PORT || 10000;

// 資料存檔路徑 (如果你有加 Disk，路徑改為 /data/users.json)
const USERS_FILE = './users.json';
const MESSAGES_FILE = './messages.json';

// 初始化資料庫檔案
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({
    "CooperChen": { password: "11036666", role: "god" }
}));
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));

app.use(express.json());

// 基礎測試頁面 (確保你點開網址時不會看到 Cannot GET)
app.get('/', (req, res) => {
    res.send(`
        <body style="background:#000; color:#0f0; font-family:monospace; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh;">
            <h1>CooperChat 12.0 外網伺服器</h1>
            <p style="color:#fff;">狀態：運作中 (Online)</p>
            <p>請使用你的專屬客戶端 HTML 檔案連線至此網址</p>
            <div style="border:1px solid #0f0; padding:10px;">伺服器時間：${new Date().toLocaleString()}</div>
        </body>
    `);
});

// 登入驗證 API
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    if (users[username] && users[username].password === password) {
        res.json({ success: true, role: users[username].role });
    } else {
        res.status(401).json({ success: false, message: '密碼錯誤' });
    }
});

// Socket.io 邏輯
io.on('connection', (socket) => {
    console.log('新使用者已連線');
    
    // 發送歷史訊息
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE));
    socket.emit('history', messages.slice(-50));

    socket.on('chat message', (data) => {
        const msgs = JSON.parse(fs.readFileSync(MESSAGES_FILE));
        const newMsg = {
            user: data.user,
            text: data.text,
            time: new Date().toLocaleTimeString(),
            type: data.type || 'text'
        };
        msgs.push(newMsg);
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msgs));
        io.emit('chat message', newMsg);
    });
});

// 【核心修正】監聽 0.0.0.0 是外網訪問的關鍵
http.listen(PORT, '0.0.0.0', () => {
    console.log(`--- CooperChat 啟動成功 ---`);
    console.log(`網址: http://0.0.0.0:${PORT}`);
});
