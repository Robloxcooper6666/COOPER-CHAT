const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const USERS_FILE = path.join(__dirname, 'users.json');
const ADMIN_NAME = "CooperChen";
const ADMIN_PASS = "11036666";

// Base64 編碼工具
const encode = (s) => Buffer.from(s).toString('base64');
const decode = (b) => Buffer.from(b, 'base64').toString('utf-8');

// 初始化
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([{ name: ADMIN_NAME, pass: encode(ADMIN_PASS), role: "admin" }], null, 2));
}

app.use(express.json());

// --- 上帝控制台 ---
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) return res.status(403).send('拒絕存取');

    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    
    res.send(`
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>God Mode Sync</title>
    <style>
        body { background: #000; color: #0f0; font-family: monospace; padding: 20px; }
        .box { border: 1px solid #0f0; padding: 15px; margin-bottom: 20px; border-radius: 10px; }
        input { background: #111; border: 1px solid #0f0; color: #0f0; padding: 5px; margin: 5px; }
        button { background: #0f0; color: #000; border: none; padding: 10px; font-weight: bold; cursor: pointer; }
        textarea { width: 100%; height: 150px; background: #111; color: #0f0; border: 1px solid #0f0; margin-top: 10px; font-size: 12px; }
    </style></head>
    <body>
        <h2>上帝控制台 - 帳號同步模式</h2>
        
        <div class="box">
            <h3>快速新增帳號</h3>
            帳號: <input id="nu"> 密碼: <input id="np">
            <button onclick="addUser()">確認新增</button>
        </div>

        <div class="box">
            <h3>GitHub 同步碼 (users.json 內容)</h3>
            <p style="color: #fff; font-size: 12px;">當你新增完人頭後，請複製下方框內所有文字，貼回 GitHub 的 users.json 檔案存檔：</p>
            <textarea id="syncBox" readonly>${JSON.stringify(users, null, 2)}</textarea>
            <br><br>
            <button onclick="copyCode()" style="background: #38bdf8;">一鍵複製同步碼</button>
        </div>

        <button onclick="location.href='/'">返回聊天室</button>

        <script>
            async function addUser() {
                const u = document.getElementById('nu').value;
                const p = document.getElementById('np').value;
                if(!u || !p) return alert('不能為空');
                
                const res = await fetch('/api/add-user', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({u, p, adminU:'${ADMIN_NAME}', adminP:'${ADMIN_PASS}'})
                });
                if(res.ok) location.reload();
            }
            function copyCode() {
                const t = document.getElementById('syncBox');
                t.select();
                document.execCommand('copy');
                alert('已複製！請現在去 GitHub 更新 users.json');
            }
        </script>
    </body></html>`);
});

// 新增使用者 API
app.post('/api/add-user', (req, res) => {
    const { u, p, adminU, adminP } = req.body;
    if (adminU !== ADMIN_NAME || adminP !== ADMIN_PASS) return res.sendStatus(403);
    
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    users.push({ name: u, pass: encode(p), role: "user" });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.sendStatus(200);
});

// 客戶端渲染 (簡化版供測試)
app.get('/', (req, res) => {
    res.send('<h1>CooperChat 運行中</h1><p>請前往上帝控制台管理帳號</p>');
});

http.listen(PORT, '0.0.0.0', () => console.log('Ready'));
