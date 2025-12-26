const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

// 模擬資料庫 (在 Render 上重啟會清空，若要永久保存建議串接 MongoDB)
let usersDB = [{name: "CooperChen", pass: "11036666", role: "admin"}];
let messageHistory = [];
let onlineUsers = new Set();
let isMuted = false;

app.get('/', (req, res) => { res.send(getHTML()); });

io.on('connection', (socket) => {
    // 註冊功能
    socket.on('register', (d) => {
        if (!d.u || !d.p) return socket.emit('err', '請輸入帳號與密碼');
        if (usersDB.find(x => x.name === d.u)) return socket.emit('err', '此名稱已被註冊');
        
        let newUser = {
            name: d.u.replace(/</g, ""), 
            pass: d.p,
            role: (d.u === "CooperChen") ? "admin" : "user" // 自動識別管理員
        };
        usersDB.push(newUser);
        socket.emit('err', '註冊成功！請直接登入');
    });

    // 登入功能
    socket.on('login', (d) => {
        const u = usersDB.find(x => x.name === d.u && x.pass === d.p);
        if(u) {
            socket.u = u;
            socket.join(u.name);
            onlineUsers.add(u.name);
            socket.emit('ok', {name: u.name, role: u.role});
            socket.emit('his', messageHistory);
            io.emit('update_users', Array.from(onlineUsers));
        } else {
            socket.emit('err', '帳號或密碼錯誤');
        }
    });

    socket.on('msg', (p) => {
        if(!socket.u || !p.c) return;
        if(isMuted && socket.u.role !== 'admin') return socket.emit('err', '🚫 目前禁言中');
        
        const cleanContent = p.c.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // 私訊處理
        if(cleanContent.startsWith('/msg ')) {
            const parts = cleanContent.split(' ');
            const target = parts[1];
            const content = parts.slice(2).join(' ');
            const dm = { s: socket.u.name, c: content, t: getTime(), dm: true };
            return io.to(target).to(socket.u.name).emit('m', dm);
        }

        const m = { 
            s: socket.u.name, 
            c: cleanContent, 
            t: getTime(), 
            a: (socket.u.role === 'admin') 
        };
        messageHistory.push(m);
        if(messageHistory.length > 100) messageHistory.shift();
        io.emit('m', m);
    });

    socket.on('admin_cmd', (cmd) => {
        if(socket.u?.role !== 'admin') return;
        if(cmd === 'clear') { messageHistory = []; io.emit('his', []); }
        if(cmd === 'mute') { isMuted = !isMuted; io.emit('sys', isMuted ? '🚫 全場禁言已開啟' : '✅ 禁言解除'); }
        if(cmd === 'kick') io.emit('force_out');
    });

    socket.on('disconnect', () => {
        if(socket.u){ onlineUsers.delete(socket.u.name); io.emit('update_users', Array.from(onlineUsers)); }
    });
});

function getTime() { return new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' }); }

function getHTML() {
    // 這裡整合了登入與註冊的 UI
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">
    <title>COOPER-CHAT Pro</title><style>
    :root { --blue: #1a73e8; --red: #d93025; --bg: #f8f9fa; }
    body{font-family:-apple-system,sans-serif;margin:0;display:flex;height:100vh;background:var(--bg);overflow:hidden}
    #auth{position:fixed;inset:0;background:#fff;z-index:100;display:flex;align-items:center;justify-content:center}
    .card{width:85%;max-width:320px;text-align:center}
    input{width:100%;padding:14px;margin:8px 0;border:1px solid #ddd;border-radius:8px;font-size:16px;box-sizing:border-box;outline:none}
    input:focus{border-color:var(--blue)}
    .btn{width:100%;padding:14px;background:var(--blue);color:#fff;border:none;border-radius:8px;font-weight:bold;font-size:16px;margin-top:10px;cursor:pointer}
    .reg-link{color:var(--blue);cursor:pointer;font-size:14px;margin-top:20px;display:inline-block}
    .side{width:220px;background:#fff;border-right:1px solid #dadce0;display:flex;flex-direction:column}
    @media(max-width:750px){.side{display:none}}
    .main{flex:1;display:flex;flex-direction:column;position:relative}
    #chat{flex:1;overflow-y:auto;padding:15px;display:flex;flex-direction:column}
    .msg{margin-bottom:12px;padding:12px;background:#fff;border-radius:12px;max-width:85%;box-shadow:0 1px 2px rgba(0,0,0,0.1);word-break:break-all}
    .me{align-self:flex-end;background:var(--blue);color:#fff}.me small{color:#e8f0fe}
    .adm-m{border-left:4px solid var(--red)}.dm-m{border-left:4px solid #9c27b0;background:#f3e5f5;color:#000}
    .input-box{padding:10px 15px;background:#fff;border-top:1px solid #dadce0;display:flex;gap:10px;padding-bottom:env(safe-area-inset-bottom)}
    #txt{flex:1;border-radius:24px;background:#f1f3f4;border:none;padding:12px 20px;font-size:16px;outline:none}
    header{padding:12px 15px;background:#fff;border-bottom:1px solid #dadce0;display:flex;justify-content:space-between;align-items:center}
    #adm-p{position:absolute;top:60px;right:15px;background:#fff;border:1px solid #dadce0;padding:15px;display:none;z-index:90;box-shadow:0 8px 24px rgba(0,0,0,0.15);border-radius:12px}
    </style></head><body>
    <div id="auth"><div class="card">
        <h2 style="color:var(--blue);font-size:28px">Google Chat</h2>
        <div id="form-title" style="margin-bottom:10px;font-weight:bold">請登入帳號</div>
        <input id="un" placeholder="使用者名稱">
        <input id="pw" type="password" placeholder="密碼">
        <button id="main-btn" onclick="authAction()" class="btn">登入</button>
        <div id="switch-mode" class="reg-link" onclick="toggleMode()">沒有帳號？點此註冊</div>
    </div></div>
    <div class="side"><div style="padding:15px;font-weight:bold;color:var(--blue);border-bottom:1px solid #eee">🟢 線上人數: <span id="count">0</span></div><div id="u-list" style="padding:15px;font-size:14px"></div></div>
    <div class="main">
        <header><b># 綜合討論區 <span id="my-n" style="color:var(--blue)"></span></b><button id="adm-entry" style="display:none;background:#fbbc04;border:none;padding:8px 16px;border-radius:20px;font-weight:bold" onclick="tAdm()">⚙️ 管理</button></header>
        <div id="adm-p">
            <button onclick="s.emit('admin_cmd','clear')" style="background:var(--red);color:#fff;width:100%;padding:10px;border:none;border-radius:5px;margin-bottom:5px">清空紀錄</button>
            <button onclick="s.emit('admin_cmd','mute')" style="background:#34a853;color:#fff;width:100%;padding:10px;border:none;border-radius:5px">禁言切換</button>
        </div>
        <div id="chat"></div>
        <div class="input-box"><input id="txt" placeholder="輸入訊息..."><button onclick="send()" style="background:none;border:none;color:var(--blue);font-size:28px">➤</button></div>
    </div>
    <script src="/socket.io/socket.io.js"></script><script>
    const s=io(); let myN=""; let mode="login";
    function toggleMode(){
        mode = (mode === "login") ? "reg" : "login";
        document.getElementById("form-title").innerText = (mode === "login") ? "請登入帳號" : "註冊新帳號";
        document.getElementById("main-btn").innerText = (mode === "login") ? "登入" : "註冊";
        document.getElementById("switch-mode").innerText = (mode === "login") ? "沒有帳號？點此註冊" : "已有帳號？點此登入";
    }
    function authAction(){
        const data = {u:un.value, p:pw.value};
        if(mode === "login") s.emit('login', data);
        else s.emit('register', data);
    }
    function send(){if(txt.value){s.emit('msg',{c:txt.value});txt.value=""}}
    function tAdm(){const p=document.getElementById("adm-p");p.style.display=p.style.display==="block"?"none":"block"}
    s.on("ok",u=>{myN=u.name;auth.style.display="none";my-n.innerText="@"+myN;if(u.role==="admin")document.getElementById("adm-entry").style.display="block"});
    s.on("update_users",l=>{document.getElementById("count").innerText=l.length; document.getElementById("u-list").innerHTML=l.map(n=>"<div style='margin-bottom:10px'>● "+n+"</div>").join("")});
    s.on("his",l=>{chat.innerHTML="";l.forEach(render)}); s.on("m",render);
    s.on("sys",t=>{const d=document.createElement("div");d.style="text-align:center;color:#5f6368;font-size:12px;margin:20px";d.innerText=t;chat.appendChild(d);chat.scrollTop=chat.scrollHeight});
    s.on("err",t=>alert(t));
    function render(m){
        const d=document.createElement("div"); d.className="msg";
        if(m.s===myN)d.classList.add("me"); if(m.a)d.classList.add("adm-m"); if(m.dm)d.classList.add("dm-m");
        d.innerHTML="<small style='font-weight:bold'>"+m.s+"</small> <small style='float:right;opacity:0.7'>"+m.t+"</small><br><div style='margin-top:5px'>"+(m.dm?"[私訊] ":"")+m.c+"</div>";
        chat.appendChild(d); chat.scrollTop=chat.scrollHeight;
    }
    txt.onkeydown=e=>{if(e.key==="Enter")send()};
    </script></body></html>`;
}
const PORT = process.env.PORT || 3000;
http.listen(PORT, "0.0.0.0", () => console.log("✅ Render Server Ready"));
