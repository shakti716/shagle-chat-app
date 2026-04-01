const socket = io();

const status = document.getElementById('status');
const chat = document.getElementById('chat');
const videos = document.getElementById('videos');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const nextButton = document.getElementById('nextButton');
const reportButton = document.getElementById('reportButton');
const videoButton = document.getElementById('videoButton');

let peerConnection;
let localStream;

socket.on('connect', () => {
  status.textContent = 'Waiting for a stranger...';
});

socket.on('chatStart', () => {
  status.style.display = 'none';
  chat.style.display = 'block';
  messageInput.disabled = false;
  sendButton.disabled = false;
  nextButton.style.display = 'inline-block';
  reportButton.style.display = 'inline-block';
  videoButton.style.display = 'inline-block';
  messages.innerHTML = '';
  addMessage('You are now connected to a stranger. Say hi!', 'system');
});

socket.on('message', (data) => {
  addMessage(data, 'stranger');
});

socket.on('partnerDisconnected', () => {
  addMessage('Stranger has disconnected.', 'system');
  messageInput.disabled = true;
  sendButton.disabled = true;
  nextButton.style.display = 'none';
  reportButton.style.display = 'none';
  videoButton.style.display = 'none';
  videos.style.display = 'none';
  closeVideoCall();
  setTimeout(() => {
    status.style.display = 'block';
    status.textContent = 'Waiting for a stranger...';
    chat.style.display = 'none';
    socket.emit('ready');
  }, 2000);
});

socket.on('waiting', () => {
  status.textContent = 'Waiting for a stranger...';
});

function addMessage(text, type) {
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
  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

nextButton.addEventListener('click', () => {
  socket.emit('nextChat');
  status.style.display = 'block';
  status.textContent = 'Finding new chat...';
  chat.style.display = 'none';
  messageInput.disabled = true;
  sendButton.disabled = true;
  nextButton.style.display = 'none';
  reportButton.style.display = 'none';
  videoButton.style.display = 'none';
  videos.style.display = 'none';
  closeVideoCall();
});

reportButton.addEventListener('click', () => {
  socket.emit('report');
  addMessage('You reported the user. Disconnecting...', 'system');
  messageInput.disabled = true;
  sendButton.disabled = true;
  nextButton.style.display = 'none';
  reportButton.style.display = 'none';
  videoButton.style.display = 'none';
  videos.style.display = 'none';
  closeVideoCall();
  setTimeout(() => {
    status.style.display = 'block';
    status.textContent = 'Waiting for a stranger...';
    chat.style.display = 'none';
  }, 2000);
});

function sendMessage() {
  const message = messageInput.value.trim();
  if (message) {
    socket.emit('message', message);
    addMessage(message, 'you');
    messageInput.value = '';
  }
}

videoButton.addEventListener('click', startVideoCall);

async function startVideoCall() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection();

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('candidate', event.candidate);
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);

    videos.style.display = 'block';
    videoButton.style.display = 'none';
  } catch (error) {
    console.error('Error starting video call:', error);
  }
}

socket.on('offer', async (offer) => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection();

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('candidate', event.candidate);
      }
    };

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);

    videos.style.display = 'block';
    videoButton.style.display = 'none';
  } catch (error) {
    console.error('Error answering video call:', error);
  }
});

socket.on('answer', async (answer) => {
  await peerConnection.setRemoteDescription(answer);
});

socket.on('candidate', async (candidate) => {
  await peerConnection.addIceCandidate(candidate);
});

function closeVideoCall() {
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
}