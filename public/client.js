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
let isInitiator = false;

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

videoButton.addEventListener('click', async () => {
  try {
    isInitiator = true;
    await prepareVideoCall();
    socket.emit('videoRequest');
    videoButton.disabled = true;
    addMessage('Video call request sent. Waiting for partner...', 'system');
  } catch (error) {
    console.error('Error starting video request', error);
    alert('Unable to start video. Check your camera/microphone permissions.');
  }
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
      videos.style.display = 'block';
    };

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('candidate', event.candidate);
      }
    };
  }
}

socket.on('videoRequest', async () => {
  if (!chat.style.display || chat.style.display === 'none') return;
  addMessage('Stranger requested video call. Starting...', 'system');
  await prepareVideoCall();
  socket.emit('videoReady');
  videoButton.style.display = 'none';
});

socket.on('videoReady', async () => {
  if (!isInitiator) return;
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);
    videos.style.display = 'block';
  } catch (error) {
    console.error('Error sending offer', error);
  }
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
    videos.style.display = 'block';
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
  videos.style.display = 'none';
}