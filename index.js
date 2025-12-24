const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 10000;

// 帳號密碼設定（你可以在這裡無腦增加人頭）
const users = {
    "CooperChen": "11036666",
    "Guest": "123456"
};

app.use(express.json());

// 這段代碼會直接產生你看到的網頁介面
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CooperChat</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        body { margin:0; font-family:sans-serif; background:#f0f2f5; display:flex; flex-direction:column; height:100vh; }
        #login { position:fixed; inset:0; background:white; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:10; }
        #box { flex:1; overflow-y:auto; padding:15px; display:flex; flex-direction:column; gap:10px; }
        .m { padding:10px; border-radius:10px; max-width:80%; word-wrap:break-word; background:white; border:1px solid #ddd; }
        .me { align-self:flex-end; background:#007aff; color:white; border:none; }
        #in { padding:10px; background:white; display:flex; border-top:1px solid #ddd; }
        input { flex:1; padding:10px; border:1px solid #ddd; border-radius:20px; outline:none; }
        button { margin-left:10px; background:#007aff; color:white; border:none; padding:0 20px; border-radius:20px; }
    </style>
</head>
<body>
    <div id="login">
        <h2>CooperChat</h2>
        <input type="text" id="u" placeholder="帳號"><br>
        <input type="password" id="p" placeholder="密碼"><br>
        <button onclick="login()">登入</button>
    </div>
    <div id="box"></div>
    <div id="in">
        <input type="text" id="msg" placeholder="輸入訊息...">
        <button onclick="send()">傳送</button>
    </div>
    <script>
        let socket, myN = "";
        const uDB = ${JSON.stringify(users)};
        function login() {
            const user = document.getElementById('u').value;
            const pass = document.getElementById('p').value;
            if(uDB[user] && uDB[user] === pass) {
                myN = user;
                document.getElementById('login').style.display='none';
                init();
            } else { alert('錯了喔！'); }
        }
        function init() {
            socket = io();
            socket.on('chat', (d) => {
                const div = document.createElement('div');
                div.className = 'm ' + (d.u === myN ? 'me' : '');
                div.innerHTML = '<b>' + d.u + ':</b> ' + d.t;
                document.getElementById('box').appendChild(div);
                document.getElementById('box').scrollTop = 99999;
            });
        }
        function send() {
            const i = document.getElementById('msg');
            if(i.value) { socket.emit('chat', {u:myN, t:i.value}); i.value=''; }
        }
    </script>
</body>
</html>
    `);
});

io.on('connection', (socket) => {
    socket.on('chat', (data) => { io.emit('chat', data); });
});

http.listen(PORT, '0.0.0.0', () => console.log('OK!'));
