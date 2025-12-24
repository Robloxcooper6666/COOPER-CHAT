const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 10000;

// 【管理員與使用者名單】
const users = {
    "CooperChen": { pass: "11036666", role: "admin" }, // 你是管理員
    "Guest": { pass: "123456", role: "user" }
};

app.use(express.json());

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CooperChat ADMIN</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        body { margin:0; font-family:sans-serif; background:#e5ddd5; display:flex; flex-direction:column; height:100vh; }
        #login { position:fixed; inset:0; background:#075e54; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:10; color:white; }
        #header { background:#075e54; color:white; padding:15px; text-align:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.2); }
        #box { flex:1; overflow-y:auto; padding:15px; display:flex; flex-direction:column; gap:10px; }
        .m { padding:10px; border-radius:10px; max-width:80%; word-wrap:break-word; background:white; position:relative; box-shadow:0 1px 1px rgba(0,0,0,0.1); }
        .me { align-self:flex-end; background:#dcf8c6; }
        /* 管理員專屬樣式 */
        .admin-msg { border: 2px solid #ff4d4d !important; }
        .admin-tag { color: #ff4d4d; font-weight: bold; font-size: 10px; display: block; }
        
        #in { padding:10px; background:#f0f0f0; display:flex; gap:5px; }
        input { flex:1; padding:12px; border:none; border-radius:20px; outline:none; }
        button { background:#075e54; color:white; border:none; padding:0 20px; border-radius:20px; font-weight:bold; }
    </style>
</head>
<body>
    <div id="login">
        <h1>CooperChat</h1>
        <input type="text" id="u" placeholder="帳號" style="flex:none; width:200px;"><br>
        <input type="password" id="p" placeholder="密碼" style="flex:none; width:200px;"><br>
        <button onclick="login()" style="width:200px; height:40px;">進入頻道</button>
    </div>
    <div id="header">CooperChat 私密頻道</div>
    <div id="box"></div>
    <div id="in">
        <input type="text" id="msg" placeholder="輸入訊息...">
        <button onclick="send()">傳送</button>
    </div>
    <script>
        let socket, myN = "", myRole = "";
        const uDB = ${JSON.stringify(users)};
        
        function login() {
            const user = document.getElementById('u').value;
            const pass = document.getElementById('p').value;
            if(uDB[user] && uDB[user].pass === pass) {
                myN = user;
                myRole = uDB[user].role;
                document.getElementById('login').style.display='none';
                init();
            } else { alert('身分驗證失敗！'); }
        }
        
        function init() {
            socket = io();
            socket.on('chat', (d) => {
                const div = document.createElement('div');
                const isAdmin = d.role === 'admin';
                div.className = 'm ' + (d.u === myN ? 'me ' : '') + (isAdmin ? 'admin-msg' : '');
                
                div.innerHTML = (isAdmin ? '<span class="admin-tag">★ 管理員</span>' : '') + 
                                '<b>' + d.u + ':</b> ' + d.t;
                
                document.getElementById('box').appendChild(div);
                document.getElementById('box').scrollTop = 999999;
            });
        }
        
        function send() {
            const i = document.getElementById('msg');
            if(i.value) { 
                socket.emit('chat', {u:myN, t:i.value, role:myRole}); 
                i.value=''; 
            }
        }
        document.getElementById('msg').onkeypress=(e)=>{ if(e.key==='Enter') send(); };
    </script>
</body>
</html>
    `);
});

io.on('connection', (socket) => {
    socket.on('chat', (data) => { io.emit('chat', data); });
});

http.listen(PORT, '0.0.0.0', () => console.log('Admin Server Ready!'));
