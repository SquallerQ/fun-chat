import {
  document,
  crypto,
  console,
  WebSocket,
  sessionStorage,
  HTMLElement,
  HTMLInputElement,
  HTMLButtonElement,
} from '../browserTypes';

interface User {
  login: string;
  online: boolean;
}

interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  datetime: number;
  status: {
    isDelivered: boolean;
    isReaded: boolean;
    isEdited: boolean;
  };
}

export function initializeChat(
  ws: WebSocket,
  users: User[],
  selectedUser: User | null,
  messageList: HTMLElement,
  messageInput: HTMLInputElement,
  sendButton: HTMLButtonElement,
): void {
  let messages: Message[] = [];

  function loadMessageHistory(login: string): void {
    const historyRequest = {
      id: crypto.randomUUID(),
      type: 'MSG_FROM_USER',
      payload: {
        user: { login },
      },
    };
    ws.send(JSON.stringify(historyRequest));
  }

  function sendMessage(text: string, to: string): void {
    const messageRequest = {
      id: crypto.randomUUID(),
      type: 'MSG_SEND',
      payload: {
        message: { to, text },
      },
    };
    ws.send(JSON.stringify(messageRequest));
    messageInput.value = '';
  }

  function renderMessages(): void {
    messageList.innerHTML = '';
    const currentLogin = sessionStorage.getItem('login') || '';

    if (messages.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'This is the beginning of the dialogue';
      messageList.appendChild(emptyMessage);
      return;
    }

    messages.forEach((msg) => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${msg.from === currentLogin ? 'sent' : 'received'}`;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'message-time';
      timeSpan.textContent = new Date(msg.datetime).toLocaleString('en-US', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      messageDiv.appendChild(timeSpan);

      const textSpan = document.createElement('span');
      textSpan.textContent = msg.text;
      textSpan.className = 'message-text';
      messageDiv.appendChild(textSpan);

      if (msg.from === currentLogin) {
        const statusSpan = document.createElement('span');
        statusSpan.className = 'message-status';
        statusSpan.textContent = msg.status.isDelivered ? '✓✓' : '✓';
        messageDiv.appendChild(statusSpan);
      }

      messageList.appendChild(messageDiv);
    });
    messageList.scrollTop = messageList.scrollHeight;
  }

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'MSG_SEND') {
      const msg = data.payload?.message;
      if (msg) {
        messages.push(msg);
        if (
          selectedUser &&
          (msg.from === selectedUser.login || msg.to === selectedUser.login)
        ) {
          renderMessages();
        }
      }
    } else if (data.type === 'MSG_FROM_USER') {
      messages = data.payload?.messages || [];
      renderMessages();
    } else if (data.type === 'ERROR') {
      console.log('Chat error:', data.payload?.error);
    }
  });

  sendButton.addEventListener('click', () => {
    if (selectedUser && messageInput.value.trim()) {
      sendMessage(messageInput.value.trim(), selectedUser.login);
    }
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && selectedUser && messageInput.value.trim()) {
      sendMessage(messageInput.value.trim(), selectedUser.login);
    }
  });

  if (selectedUser) {
    loadMessageHistory(selectedUser.login);
  }
}
