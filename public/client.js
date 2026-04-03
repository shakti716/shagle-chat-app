const socket = io();

const selectionScreen = document.getElementById('selectionScreen');
const appGrid = document.getElementById('appGrid');
const chatOnlyGrid = document.getElementById('chatOnlyGrid');

const status = document.getElementById('status');
const chat = document.getElementById('chat');
const videoStage = document.getElementById('video-stage');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const nextButton = document.getElementById('nextButton');
const reportButton = document.getElementById('reportButton');
const muteButton = document.getElementById('muteButton');

const statusChat = document.getElementById('statusChat');
const chatOnly = document.getElementById('chatOnly');
const messagesChat = document.getElementById('messagesChat');
const messageInputChat = document.getElementById('messageInputChat');
const sendButtonChat = document.getElementById('sendButtonChat');
const nextButtonChat = document.getElementById('nextButtonChat');
const reportButtonChat = document.getElementById('reportButtonChat');

let peerConnection;
let localStream;
let isInitiator = false;
let isMuted = false;
let isChatOnly = false;

const chatOnlyBtn = document.getElementById('chatOnlyBtn');
const videoCallBtn = document.getElementById('videoCallBtn');

chatOnlyBtn.addEventListener('click', () => {
  isChatOnly = true;
  selectionScreen.style.display = 'none';
  chatOnlyGrid.style.display = 'block';
  socket.emit('ready');
});

videoCallBtn.addEventListener('click', () => {
  isChatOnly = false;
  selectionScreen.style.display = 'none';
  appGrid.style.display = 'block';
  socket.emit('ready');
});

socket.on('connect', () => {
  status.textContent = 'Waiting for a stranger...';
});

socket.on('chatStart', () => {
  if (isChatOnly) {
    statusChat.style.display = 'none';
    chatOnly.style.display = 'block';
    messageInputChat.disabled = false;
    sendButtonChat.disabled = false;
    nextButtonChat.style.display = 'inline-block';
    reportButtonChat.style.display = 'inline-block';
    messagesChat.innerHTML = '';
    addMessage('You are now connected to a stranger. Say hi!', 'system', true);
  } else {
    status.style.display = 'none';
    chat.style.display = 'block';
    messageInput.disabled = false;
    sendButton.disabled = false;
    nextButton.style.display = 'inline-block';
    reportButton.style.display = 'inline-block';
    muteButton.style.display = 'inline-block';
    muteButton.textContent = '🔇 Mute';
    isMuted = false;
    messages.innerHTML = '';
    addMessage('You are now connected to a stranger. Say hi!', 'system', false);
    // Start video immediately for video call mode
    prepareVideoCall().then(() => {
      if (videoStage) videoStage.style.display = 'block';
      // Initiate WebRTC offer
      peerConnection.createOffer().then(offer => {
        return peerConnection.setLocalDescription(offer);
      }).then(() => {
        socket.emit('offer', peerConnection.localDescription);
      }).catch(error => {
        console.error('Error creating offer', error);
      });
    }).catch(error => {
      console.error('Error starting video', error);
    });
  }
});

socket.on('message', (data) => {
  addMessage(data, 'stranger', isChatOnly);
});

socket.on('partnerDisconnected', () => {
  if (isChatOnly) {
    addMessage('Stranger has disconnected.', 'system', true);
    messageInputChat.disabled = true;
    sendButtonChat.disabled = true;
    nextButtonChat.style.display = 'none';
    reportButtonChat.style.display = 'none';
  } else {
    addMessage('Stranger has disconnected.', 'system', false);
    messageInput.disabled = true;
    sendButton.disabled = true;
    nextButton.style.display = 'none';
    reportButton.style.display = 'none';
    if (videoStage) videoStage.style.display = 'none';
    closeVideoCall();
  }
  setTimeout(() => {
    if (isChatOnly) {
      statusChat.style.display = 'block';
      statusChat.textContent = 'Waiting for a stranger...';
      chatOnly.style.display = 'none';
    } else {
      status.style.display = 'block';
      status.textContent = 'Waiting for a stranger...';
      chat.style.display = 'none';
    }
    socket.emit('ready');
  }, 2000);
});

socket.on('waiting', () => {
  if (isChatOnly) {
    statusChat.textContent = 'Waiting for a stranger...';
  } else {
    status.textContent = 'Waiting for a stranger...';
  }
});

function addMessage(text, type, chatOnly = false) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');
  if (type === 'you') {
    messageDiv.classList.add('you');
  } else if (type === 'stranger') {
    messageDiv.classList.add('stranger');
  } else {
    messageDiv.style.fontStyle = 'italic';
    messageDiv.style.color = '#666';
  }
  messageDiv.textContent = text;
  if (chatOnly) {
    messagesChat.appendChild(messageDiv);
    messagesChat.scrollTop = messagesChat.scrollHeight;
  } else {
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
  }
}

sendButton.addEventListener('click', () => sendMessage(false));
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage(false);
  }
});

nextButton.addEventListener('click', () => nextChat(false));

sendButtonChat.addEventListener('click', () => sendMessage(true));
messageInputChat.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage(true);
  }
});

nextButtonChat.addEventListener('click', () => nextChat(true));
reportButtonChat.addEventListener('click', () => reportUser(true));

muteButton.addEventListener('click', () => {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
  muteButton.textContent = isMuted ? '🔈 Unmute' : '🔇 Mute';
});

async function prepareVideoCall() {
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  }

  if (!peerConnection) {
    peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
      if (videoStage) videoStage.style.display = 'block';
    };

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('candidate', event.candidate);
      }
    };
  }
}

socket.on('videoRequest', async () => {
  // Since video is always on, just acknowledge
  socket.emit('videoReady');
});

socket.on('videoReady', async () => {
  // Video is already started
});

socket.on('offer', async (offer) => {
  try {
    if (!peerConnection) {
      await prepareVideoCall();
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
    if (videoStage) videoStage.style.display = 'block';
    muteButton.style.display = 'inline-block';
    muteButton.textContent = isMuted ? '🔈 Unmute' : '🔇 Mute';
  } catch (error) {
    console.error('Error handling offer', error);
  }
});

socket.on('answer', async (answer) => {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (error) {
    console.error('Error handling answer', error);
  }
});

socket.on('candidate', async (candidate) => {
  try {
    if (candidate && peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (error) {
    console.error('Error adding ICE candidate', error);
  }
});

function closeVideoCall() {
  isInitiator = false;
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  videoButton.style.display = 'inline-block';
  videoButton.disabled = false;
  muteButton.style.display = 'none';
  if (videoStage) videoStage.style.display = 'none';
}

function nextChat(chatOnly = false) {
  socket.emit('nextChat');
  if (chatOnly) {
    statusChat.style.display = 'block';
    statusChat.textContent = 'Finding new chat...';
    chatOnly.style.display = 'none';
    messageInputChat.disabled = true;
    sendButtonChat.disabled = true;
    nextButtonChat.style.display = 'none';
    reportButtonChat.style.display = 'none';
  } else {
    status.style.display = 'block';
    status.textContent = 'Finding new chat...';
    chat.style.display = 'none';
    messageInput.disabled = true;
    sendButton.disabled = true;
    nextButton.style.display = 'none';
    reportButton.style.display = 'none';
    muteButton.style.display = 'none';
    if (videoStage) videoStage.style.display = 'none';
    closeVideoCall();
  }
  setTimeout(() => {
    if (chatOnly) {
      statusChat.style.display = 'block';
      statusChat.textContent = 'Waiting for a stranger...';
      chatOnly.style.display = 'none';
    } else {
      status.style.display = 'block';
      status.textContent = 'Waiting for a stranger...';
      chat.style.display = 'none';
    }
    socket.emit('ready');
  }, 2000);
}

function reportUser(chatOnly = false) {
  socket.emit('report');
  addMessage('You reported the user. Disconnecting...', 'system', chatOnly);
  if (chatOnly) {
    messageInputChat.disabled = true;
    sendButtonChat.disabled = true;
    nextButtonChat.style.display = 'none';
    reportButtonChat.style.display = 'none';
  } else {
    messageInput.disabled = true;
    sendButton.disabled = true;
    nextButton.style.display = 'none';
    reportButton.style.display = 'none';
    if (videoStage) videoStage.style.display = 'none';
    closeVideoCall();
  }
  setTimeout(() => {
    if (chatOnly) {
      statusChat.style.display = 'block';
      statusChat.textContent = 'Waiting for a stranger...';
      chatOnly.style.display = 'none';
    } else {
      status.style.display = 'block';
      status.textContent = 'Waiting for a stranger...';
      chat.style.display = 'none';
    }
  }, 2000);
}

function setTheme(theme) {
  document.body.classList.remove('light-theme', 'dark-theme');
  document.body.classList.add(theme);
  localStorage.setItem('umingleTheme', theme);
  const toggle = document.getElementById('themeToggle');
  toggle.textContent = theme === 'dark-theme' ? 'Light mode' : 'Dark mode';
}

const savedTheme = localStorage.getItem('umingleTheme') || 'dark-theme';
setTheme(savedTheme);

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.body.classList.contains('dark-theme') ? 'dark-theme' : 'light-theme';
    setTheme(current === 'dark-theme' ? 'light-theme' : 'dark-theme');
  });
}