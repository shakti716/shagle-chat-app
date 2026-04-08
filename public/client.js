const socket = io();

const status = document.getElementById('status');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const nextButton = document.getElementById('nextButton');
const reportButton = document.getElementById('reportButton');

socket.on('connect', () => {
  status.textContent = 'Waiting for a stranger...';
  socket.emit('ready');
});

socket.on('chatStart', () => {
  status.textContent = 'Connected. Say hi!';
  messageInput.disabled = false;
  sendButton.disabled = false;
  nextButton.style.display = 'inline-block';
  reportButton.style.display = 'inline-block';
  messages.innerHTML = '';
  addMessage('You are now connected to a stranger. Say hi!', 'system');
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
  status.textContent = 'Waiting for a stranger...';
  socket.emit('ready');
});

socket.on('waiting', () => {
  status.textContent = 'Waiting for a stranger...';
});

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

nextButton.addEventListener('click', () => {
  socket.emit('nextChat');
  status.textContent = 'Searching for a new chat...';
  messageInput.disabled = true;
  sendButton.disabled = true;
  nextButton.style.display = 'none';
  reportButton.style.display = 'none';
});

reportButton.addEventListener('click', () => {
  socket.emit('report');
  addMessage('You reported the user. Finding a new stranger...', 'system');
  messageInput.disabled = true;
  sendButton.disabled = true;
  nextButton.style.display = 'none';
  reportButton.style.display = 'none';
  socket.emit('nextChat');
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit('message', text);
  addMessage(text, 'you');
  messageInput.value = '';
}

function addMessage(text, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ' + type;
  messageDiv.textContent = text;
  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;
}
