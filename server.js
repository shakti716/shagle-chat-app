const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static('public'));

// Store waiting users with their mode
let waitingUsers = [];

// Store active chats (user pairs)
let activeChats = new Map();

function tryPair() {
  // Group users by mode
  const chatUsers = waitingUsers.filter(u => u.mode === 'chat');
  const videoUsers = waitingUsers.filter(u => u.mode === 'video');

  // Pair chat users
  while (chatUsers.length >= 2) {
    const user1 = chatUsers.shift();
    const user2 = chatUsers.shift();

    // Remove from waiting
    waitingUsers = waitingUsers.filter(u => u.id !== user1.id && u.id !== user2.id);

    // Create a room for the pair
    const room = `chat_${user1.id}_${user2.id}`;
    activeChats.set(user1.id, { partner: user2.id, room, mode: 'chat' });
    activeChats.set(user2.id, { partner: user1.id, room, mode: 'chat' });

    // Join both to the room
    io.sockets.sockets.get(user1.id).join(room);
    io.sockets.sockets.get(user2.id).join(room);

    // Notify both users that they are connected
    io.to(room).emit('chatStart');
  }

  // Pair video users
  while (videoUsers.length >= 2) {
    const user1 = videoUsers.shift();
    const user2 = videoUsers.shift();

    // Remove from waiting
    waitingUsers = waitingUsers.filter(u => u.id !== user1.id && u.id !== user2.id);

    // Create a room for the pair
    const room = `video_${user1.id}_${user2.id}`;
    activeChats.set(user1.id, { partner: user2.id, room, mode: 'video' });
    activeChats.set(user2.id, { partner: user1.id, room, mode: 'video' });

    // Join both to the room
    io.sockets.sockets.get(user1.id).join(room);
    io.sockets.sockets.get(user2.id).join(room);

    // Notify both users that they are connected
    io.to(room).emit('chatStart');
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User will send 'ready' with mode when they select

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

      // Remove from waiting if still there
      waitingUsers = waitingUsers.filter(u => u.id !== chatInfo.partner);
    } else {
      // Remove from waiting users
      waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
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

      // Add to waiting with same mode
      waitingUsers.push({ id: socket.id, mode: chatInfo.mode });
      socket.emit('waiting');

      // Try to pair again
      tryPair();
    }
  });

  // Handle ready for new chat
  socket.on('ready', (data) => {
    const mode = data?.mode || 'chat'; // default to chat if not specified
    waitingUsers.push({ id: socket.id, mode });
    tryPair();
  });

  // WebRTC signaling (only for video mode)
  socket.on('videoRequest', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo && chatInfo.mode === 'video') {
      socket.to(chatInfo.room).emit('videoRequest');
    }
  });

  socket.on('videoReady', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo && chatInfo.mode === 'video') {
      socket.to(chatInfo.room).emit('videoReady');
    }
  });

  socket.on('offer', (offer) => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo && chatInfo.mode === 'video') {
      socket.to(chatInfo.room).emit('offer', offer);
    }
  });

  socket.on('answer', (answer) => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo && chatInfo.mode === 'video') {
      socket.to(chatInfo.room).emit('answer', answer);
    }
  });

  socket.on('candidate', (candidate) => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo && chatInfo.mode === 'video') {
      socket.to(chatInfo.room).emit('candidate', candidate);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});