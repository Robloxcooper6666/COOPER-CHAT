// ==========================
// 1. 修正後的管理員上帝後台
// ==========================
app.get('/master-panel', (req, res) => {
    const { u, p } = req.query;
    if (u !== ADMIN_NAME || p !== ADMIN_PASS) {
        return res.status(403).send('<body style="background:#000;color:red;display:flex;justify-content:center;align-items:center;height:100vh;"><h1>ACCESS DENIED</h1></body>');
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const msgs = JSON.parse(fs.readFileSync(MSGS_FILE));
    
    // 取得所有上傳過的檔案清單
    const files = msgs.filter(m => m.file).map(m => `
        <div class="file-item">
            <span>[${m.s}] ${m.fName}</span>
            <a href="${m.file}" download="${m.fName}">下載</a>
            <button class="danger" onclick="cmd('delMsg','${m.id}')">刪除檔案</button>
        </div>
    `).join('');

    const userListHtml = users.map(user => {
        const isOnline = Object.values(onlineUsers).includes(user.name);
        return `
        <div class="card ${isOnline ? 'online' : ''}">
            <div class="info">
                <strong>${user.name}</strong> 
                <span class="tag">${user.name === ADMIN_NAME ? 'MASTER' : 'USER'}</span>
                <div style="font-size:10px; color:#888;">註冊: ${user.regTime}</div>
            </div>
            <div class="actions">
                ${user.name !== ADMIN_NAME ? `
                    <button onclick="cmd('mute','${user.name}')">${user.isMuted ? '✅ 解禁' : '🔇 禁言'}</button>
                    <button class="danger" onclick="cmd('kick','${user.name}')">🚫 踢出</button>
                    <button class="danger" onclick="cmd('wipe','${user.name}')">🧹 抹除言論</button>
                ` : '<span>(系統核心)</span>'}
            </div>
        </div>`;
    }).join('');

    res.send(`
    <style>
        body { background: #0f172a; color: #fff; font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 1200px; margin: 0 auto; }
        .panel { background: rgba(30,41,59,0.7); backdrop-filter: blur(10px); border-radius: 20px; padding: 20px; border: 1px solid rgba(255,255,255,0.1); }
        h2 { color: #38bdf8; border-bottom: 1px solid #333; padding-bottom: 10px; }
        .card { background: rgba(0,0,0,0.2); margin-bottom: 10px; padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #444; }
        .card.online { border-left-color: #2ecc71; background: rgba(46,204,113,0.05); }
        .tag { background: #333; font-size: 10px; padding: 2px 6px; border-radius: 4px; }
        button { background: #334155; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s; }
        button:hover { background: #38bdf8; color: #000; }
        button.danger:hover { background: #ef4444; }
        .file-item { display: flex; justify-content: space-between; font-size: 12px; padding: 8px; border-bottom: 1px solid #333; }
        .file-item a { color: #38bdf8; text-decoration: none; }
    </style>
    <div class="grid">
        <div class="panel">
            <h2>👤 用戶情報系統 <button onclick="location.href='/'">返回</button></h2>
            ${userListHtml}
        </div>
        <div class="panel">
            <h2>📁 檔案審核與日誌</h2>
            <div style="max-height: 400px; overflow-y: auto;">
                ${files || '<p style="color:#666">目前無上傳檔案</p>'}
            </div>
            <hr style="border:0; border-top:1px solid #333; margin:20px 0;">
            <h3>🛡️ 全局指令</h3>
            <button class="danger" style="width:100%" onclick="cmd('clearChat','')">清空伺服器所有歷史訊息</button>
        </div>
    </div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        function cmd(a, t){
            if(confirm('上帝指令：確定執行 [' + a + '] 於 ' + t + '？')){
                socket.emit('god_cmd', {a, t, n:'${ADMIN_NAME}', p:'${ADMIN_PASS}'});
                setTimeout(()=>location.reload(), 300);
            }
        }
    </script>
    `);
});

// ==========================
// 2. 修正後的後端指令邏輯 (god_cmd)
// ==========================
socket.on('god_cmd', (d) => {
    if(d.n === ADMIN_NAME && d.p === ADMIN_PASS) {
        let users = JSON.parse(fs.readFileSync(USERS_FILE));
        let msgs = JSON.parse(fs.readFileSync(MSGS_FILE));

        if(d.a === 'clearChat') {
            fs.writeFileSync(MSGS_FILE, JSON.stringify([]));
            io.emit('history', []);
        } else if(d.a === 'delMsg') {
            const filtered = msgs.filter(m => m.id !== d.t);
            fs.writeFileSync(MSGS_FILE, JSON.stringify(filtered));
            io.emit('history', filtered);
        } else if(d.a === 'wipe') {
            const filtered = msgs.filter(m => m.s !== d.t);
            fs.writeFileSync(MSGS_FILE, JSON.stringify(filtered));
            io.emit('history', filtered);
        } else if(d.a === 'kick') {
            // 透過 Room 或 ID 找到該用戶並強制登出
            io.emit('force_logout', d.t);
        } else {
            let i = users.findIndex(x=>x.name===d.t);
            if(i !== -1) {
                if(d.a === 'mute') users[i].isMuted = !users[i].isMuted;
                fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            }
        }
    }
});
