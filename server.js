const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let waitingUsers = [];
let activeChats = new Map();

function tryPair() {
  while (waitingUsers.length >= 2) {
    const user1 = waitingUsers.shift();
    const user2 = waitingUsers.shift();
    const room = `chat_${user1}_${user2}`;

    activeChats.set(user1, { partner: user2, room });
    activeChats.set(user2, { partner: user1, room });

    const socket1 = io.sockets.sockets.get(user1);
    const socket2 = io.sockets.sockets.get(user2);
    if (socket1 && socket2) {
      socket1.join(room);
      socket2.join(room);
      io.to(room).emit('chatStart');
    }
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  waitingUsers.push(socket.id);
  tryPair();

  socket.on('message', (text) => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      socket.to(chatInfo.room).emit('message', text);
    }
  });

  socket.on('report', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      socket.to(chatInfo.room).emit('partnerDisconnected');
      activeChats.delete(chatInfo.partner);
      activeChats.delete(socket.id);
    }
  });

  socket.on('ready', () => {
    if (!waitingUsers.includes(socket.id) && !activeChats.has(socket.id)) {
      waitingUsers.push(socket.id);
      tryPair();
    }
  });

  socket.on('nextChat', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      socket.to(chatInfo.room).emit('partnerDisconnected');
      const partnerId = chatInfo.partner;
      activeChats.delete(partnerId);
      activeChats.delete(socket.id);

      if (!waitingUsers.includes(partnerId) && io.sockets.sockets.has(partnerId)) {
        waitingUsers.push(partnerId);
        tryPair();
      }
    }
    if (!waitingUsers.includes(socket.id)) {
      waitingUsers.push(socket.id);
    }
    socket.emit('waiting');
    tryPair();
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      const partnerId = chatInfo.partner;
      socket.to(chatInfo.room).emit('partnerDisconnected');
      activeChats.delete(partnerId);
      if (!waitingUsers.includes(partnerId) && io.sockets.sockets.has(partnerId)) {
        waitingUsers.push(partnerId);
        tryPair();
      }
    }
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
    activeChats.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
