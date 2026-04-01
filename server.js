const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static('public'));

// Store waiting users
let waitingUsers = [];

// Store active chats (user pairs)
let activeChats = new Map();

function tryPair() {
  while (waitingUsers.length >= 2) {
    const user1 = waitingUsers.shift();
    const user2 = waitingUsers.shift();

    // Create a room for the pair
    const room = `chat_${user1}_${user2}`;
    activeChats.set(user1, { partner: user2, room });
    activeChats.set(user2, { partner: user1, room });

    // Join both to the room
    io.sockets.sockets.get(user1).join(room);
    io.sockets.sockets.get(user2).join(room);

    // Notify both users that they are connected
    io.to(room).emit('chatStart');
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Add user to waiting queue
  waitingUsers.push(socket.id);

  // Try to pair users
  tryPair();

  // Handle chat messages
  socket.on('message', (data) => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      socket.to(chatInfo.room).emit('message', data);
    }
  });

  // Handle report
  socket.on('report', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      console.log(`User ${socket.id} reported user ${chatInfo.partner}`);
      // Disconnect both
      socket.to(chatInfo.room).emit('partnerDisconnected');
      activeChats.delete(chatInfo.partner);
      activeChats.delete(socket.id);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      // Notify partner
      socket.to(chatInfo.room).emit('partnerDisconnected');

      // Remove partner from active chats
      activeChats.delete(chatInfo.partner);

      // Remove from waiting if still there (unlikely)
      const index = waitingUsers.indexOf(chatInfo.partner);
      if (index > -1) {
        waitingUsers.splice(index, 1);
      }
    } else {
      // Remove from waiting users
      const index = waitingUsers.indexOf(socket.id);
      if (index > -1) {
        waitingUsers.splice(index, 1);
      }
    }

    activeChats.delete(socket.id);
  });

  // Handle next chat request
  socket.on('nextChat', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      // Disconnect current chat
      socket.to(chatInfo.room).emit('partnerDisconnected');
      activeChats.delete(chatInfo.partner);
      activeChats.delete(socket.id);

      // Add to waiting
      waitingUsers.push(socket.id);
      socket.emit('waiting');

      // Try to pair again
      tryPair();
    }
  });

  // Handle ready for new chat
  socket.on('ready', () => {
    waitingUsers.push(socket.id);
    tryPair();
  });

  // WebRTC signaling
  socket.on('videoRequest', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      socket.to(chatInfo.room).emit('videoRequest');
    }
  });

  socket.on('videoReady', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      socket.to(chatInfo.room).emit('videoReady');
    }
  });

  socket.on('offer', (offer) => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      socket.to(chatInfo.room).emit('offer', offer);
    }
  });

  socket.on('answer', (answer) => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      socket.to(chatInfo.room).emit('answer', answer);
    }
  });

  socket.on('candidate', (candidate) => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      socket.to(chatInfo.room).emit('candidate', candidate);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});