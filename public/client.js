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

// Initialize local video stream
async function initializeVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true
    });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error('Error accessing media devices:', err);
    addMessage('Unable to access camera/microphone. Please check permissions.', 'system');
  }
}

// Create WebRTC peer connection
function initiatePeerConnection(initiator) {
  if (peer) {
    peer.destroy();
  }

  peer = new SimplePeer({
    initiator: initiator,
    stream: localStream,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });

  peer.on('signal', (data) => {
    if (data.type === 'offer') {
      socket.emit('webrtc-offer', data);
    } else if (data.type === 'answer') {
      socket.emit('webrtc-answer', data);
    } else if (data.candidate) {
      socket.emit('webrtc-ice-candidate', data);
    }
  });

  peer.on('stream', (stream) => {
    remoteVideo.srcObject = stream;
  });

  peer.on('error', (err) => {
    console.error('Peer connection error:', err);
  });

  peer.on('close', () => {
    remoteVideo.srcObject = null;
  });
}

// Stop and clean up video
function stopVideo() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (peer) {
    peer.destroy();
    peer = null;
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  cameraEnabled = true;
  micEnabled = true;
  cameraToggle.textContent = '📷 Camera ON';
  micToggle.textContent = '🎤 Mic ON';
  cameraToggle.classList.remove('off');
  micToggle.classList.remove('off');
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

// Socket events
socket.on('connect', () => {
  status.textContent = 'Waiting for a stranger...';
  initializeVideo();
  socket.emit('ready');
});

socket.on('chatStart', () => {
  status.textContent = 'Connected. Starting video call...';
  messageInput.disabled = false;
  sendButton.disabled = false;
  nextButton.style.display = 'inline-block';
  reportButton.style.display = 'inline-block';
  messages.innerHTML = '';
  addMessage('You are now connected to a stranger. Say hi!', 'system');
  
  // Initiate peer connection (this user is the initiator)
  initiatePeerConnection(true);
});

socket.on('webrtc-offer', (offer) => {
  if (!peer) {
    initiatePeerConnection(false);
  }
  peer.signal(offer);
});

socket.on('webrtc-answer', (answer) => {
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
  addMessage('Stranger disconnected.', 'system');
  messageInput.disabled = true;
  sendButton.disabled = true;
  nextButton.style.display = 'none';
  reportButton.style.display = 'none';
  stopVideo();
  status.textContent = 'Waiting for a stranger...';
  socket.emit('ready');
});

socket.on('waiting', () => {
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
  stopVideo();
});
