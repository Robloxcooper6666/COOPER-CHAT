const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');

const PORT = process.env.PORT || 10000;

// 自動建立資料庫
const USERS_FILE = './users.json';
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({
    "CooperChen": { password: "11036666", role: "god" }
}));

app.use(express.json());

// 【重點】讓 Render 直接顯示你的聊天介面
app.get('/', (req, res) => {
    // 這裡會直接傳送下面的 HTML 給使用者
    res.sendFile(__dirname + '/index.html');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    if (users[username] && users[username].password === password) {
        res.json({ success: true, role: users[username].role });
    } else {
        res.status(401).json({ success: false });
    }
});

io.on('connection', (socket) => {
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });
});

http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
