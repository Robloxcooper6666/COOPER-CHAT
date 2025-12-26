const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const ADM = "CooperChen";
let isMuted = false;
let onlineUsers = new Set();
let messages = []; // Render 建議先存入記憶體

app.get('/', (req, res) => { res.send(getHTML()); });

io.on('connection', (socket) => {
    socket.on('login', (d) => {
        // Render 版預設登入邏輯 (你可以根據需求擴充)
        if (d.u === ADM && d.p === "11036666") {
            socket.u = {name: ADM, role: "admin"};
        } else if (d.u && d.p) {
            socket.u = {name: d.u, role: "user"};
        } else return;

        socket.join(socket.u.name);
        onlineUsers.add(socket.u.name);
        socket.emit('ok', socket.u);
        socket.emit('his', messages);
        io.emit('update_users', Array.from(onlineUsers));
    });

    socket.on('msg', (p) => {
        if(!socket.u || !p.c) return;
        if(isMuted && socket.u.role !== 'admin') return socket.emit('err', '禁言中');
        
        const m = { 
            s: socket.u.name, 
            c: p.c.replace(/</g, "&lt;"), 
            t: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), 
            a: socket.u.role === 'admin' 
        };
        messages.push(m);
        if(messages.length > 100) messages.shift();
        io.emit('m', m);
    });

    socket.on('admin_cmd', (cmd) => {
        if(socket.u?.role !== 'admin') return;
        if(cmd === 'clear') { messages = []; io.emit('his', []); }
        if(cmd === 'mute') { isMuted = !isMuted; io.emit('sys', isMuted ? '🚫 全場禁言' : '✅ 禁言解除'); }
    });

    socket.on('disconnect', () => {
        if(socket.u){ onlineUsers.delete(socket.u.name); io.emit('update_users', Array.from(onlineUsers)); }
    });
});

function getHTML() {
    // 這裡使用之前的手機友善 UI HTML 代碼 (省略以保持簡潔)
    return `... (同前一版的完整 HTML 代碼) ...`;
}

// Render 會自動分配 PORT，必須使用 process.env.PORT
const PORT = process.env.PORT || 3000;
http.listen(PORT, "0.0.0.0", () => console.log("Cloud Server Running"));
