const socket = io();

const status = document.getElementById('status');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const nextButton = document.getElementById('nextButton');
const reportButton = document.getElementById('reportButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const cameraToggle = document.getElementById('cameraToggle');
const micToggle = document.getElementById('micToggle');

let peer = null;
let localStream = null;
let cameraEnabled = true;
let micEnabled = true;
let isInitiator = false;

// Initialize local video stream
async function initializeVideo() {
  try {
    if (localStream) {
      return; // Stream already initialized
    }
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true
    });
    if (localVideo) {
      localVideo.srcObject = localStream;
    }
  } catch (err) {
    console.error('Error accessing media devices:', err);
    addMessage('Unable to access camera/microphone. Please check permissions.', 'system');
  }
}

// Create WebRTC peer connection
function initiatePeerConnection(initiator) {
  if (peer) {
    peer.destroy();
    peer = null;
  }

  isInitiator = initiator;

  const peerConfig = {
    initiator: initiator,
    trickleIce: true,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }
  };

  if (localStream) {
    peerConfig.streams = [localStream];
  }

  peer = new SimplePeer(peerConfig);

  peer.on('signal', (data) => {
    console.log('Signal event:', data.type || 'ice-candidate');
    if (data.type === 'offer') {
      socket.emit('webrtc-offer', data);
    } else if (data.type === 'answer') {
      socket.emit('webrtc-answer', data);
    } else {
      socket.emit('webrtc-ice-candidate', data);
    }
  });

  peer.on('connect', () => {
    console.log('Peer connection established');
    status.textContent = 'Connected. Video call active!';
  });

  peer.on('stream', (stream) => {
    console.log('Remote stream received');
    remoteVideo.srcObject = stream;
  });

  peer.on('error', (err) => {
    console.error('Peer connection error:', err);
  });

  peer.on('close', () => {
    console.log('Peer connection closed');
    remoteVideo.srcObject = null;
  });
}

// Stop and clean up video peer connection only
function stopVideo() {
  if (peer) {
    peer.destroy();
    peer = null;
  }
  remoteVideo.srcObject = null;
  isInitiator = false;
}

// Toggle camera
cameraToggle.addEventListener('click', () => {
  if (localStream) {
    cameraEnabled = !cameraEnabled;
    localStream.getVideoTracks().forEach(track => track.enabled = cameraEnabled);
    cameraToggle.textContent = cameraEnabled ? '📷 Camera ON' : '📷 Camera OFF';
    cameraToggle.classList.toggle('off');
  }
});

// Toggle microphone
micToggle.addEventListener('click', () => {
  if (localStream) {
    micEnabled = !micEnabled;
    localStream.getAudioTracks().forEach(track => track.enabled = micEnabled);
    micToggle.textContent = micEnabled ? '🎤 Mic ON' : '🎤 Mic OFF';
    micToggle.classList.toggle('off');
  }
});

socket.on('connect', () => {
  console.log('Socket connected');
  status.textContent = 'Waiting for a stranger...';
  initializeVideo();
  socket.emit('ready');
});

socket.on('chatStart', () => {
  console.log('Chat started');
  status.textContent = 'Connected. Starting video call...';
  messageInput.disabled = false;
  sendButton.disabled = false;
  nextButton.style.display = 'inline-block';
  reportButton.style.display = 'inline-block';
  messages.innerHTML = '';
  addMessage('You are now connected to a stranger. Say hi!', 'system');
  
  // Initiate peer connection (first user is the initiator)
  setTimeout(() => {
    initiatePeerConnection(true);
  }, 100);
});

socket.on('webrtc-offer', (offer) => {
  console.log('Received offer');
  if (!peer) {
    initiatePeerConnection(false);
  }
  if (peer) {
    peer.signal(offer);
  }
});

socket.on('webrtc-answer', (answer) => {
  console.log('Received answer');
  if (peer) {
    peer.signal(answer);
  }
});

socket.on('webrtc-ice-candidate', (candidate) => {
  if (peer) {
    peer.signal(candidate);
  }
});

socket.on('message', (text) => {
  addMessage(text, 'stranger');
});

socket.on('partnerDisconnected', () => {
  console.log('Partner disconnected');
  addMessage('Stranger disconnected.', 'system');
  messageInput.disabled = true;
  sendButton.disabled = true;
  nextButton.style.display = 'none';
  reportButton.style.display = 'none';
  stopVideo();
  status.textContent = 'Waiting for a stranger...';
  setTimeout(() => {
    socket.emit('ready');
  }, 500);
});

socket.on('waiting', () => {
  console.log('Waiting for stranger');
  status.textContent = 'Waiting for a stranger...';
  stopVideo();
});

// Send message
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit('message', text);
  addMessage(text, 'you');
  messageInput.value = '';
}

// Next chat
nextButton.addEventListener('click', () => {
  socket.emit('nextChat');
  status.textContent = 'Searching for a new chat...';
  messageInput.disabled = true;
  sendButton.disabled = true;
  nextButton.style.display = 'none';
  reportButton.style.display = 'none';
  stopVideo();
});

// Report user
reportButton.addEventListener('click', () => {
  socket.emit('report');
  addMessage('You reported the user. Finding a new stranger...', 'system');
  messageInput.disabled = true;
  sendButton.disabled = true;
  nextButton.style.display = 'none';
  reportButton.style.display = 'none';
  stopVideo();
  socket.emit('nextChat');
});

// Add message to chat
function addMessage(text, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ' + type;
  messageDiv.textContent = text;
  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  if (peer) {
    peer.destroy();
  }
});
