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
    isDeleted: boolean;
  };
}

const messagesByChat: Record<string, Message[]> = {};
let currentChatKey: string | null = null;

const eventListeners: {
  sendButton?: () => void;
  // eslint-disable-next-line no-unused-vars
  messageInput?: (e: KeyboardEvent) => void;
} = {};

// eslint-disable-next-line no-unused-vars
let wsMessageHandler: ((event: MessageEvent) => void) | null = null;

function getChatKey(user1: string, user2: string): string {
  return [user1, user2].sort().join('::');
}

export function initializeChat(
  ws: WebSocket,
  users: User[],
  selectedUser: User | null,
  messageList: HTMLElement,
  messageInput: HTMLInputElement,
  sendButton: HTMLButtonElement,
  from: string,
  to: string,
): void {
  if (!to || !from) return;

  const chatKey = getChatKey(from, to);
  currentChatKey = chatKey;

  if (!messagesByChat[chatKey]) {
    messagesByChat[chatKey] = [];
  }

  let showUnreadDivider = true;
  let editingMessageId: string | null = null;

  function loadMessageHistory(login: string): void {
    showUnreadDivider = true;
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
    const trimmedText = text.trim();
    if (!trimmedText || !to) return;

    if (editingMessageId) {
      const editRequest = {
        id: crypto.randomUUID(),
        type: 'MSG_EDIT',
        payload: {
          message: {
            id: editingMessageId,
            text: trimmedText,
          },
        },
      };
      ws.send(JSON.stringify(editRequest));
      editingMessageId = null;
    } else {
      const messageRequest = {
        id: crypto.randomUUID(),
        type: 'MSG_SEND',
        payload: {
          message: { to, text: trimmedText },
        },
      };
      ws.send(JSON.stringify(messageRequest));
    }

    messageInput.value = '';
  }

  function renderMessages(): void {
    messageList.innerHTML = '';

    const messages = messagesByChat[chatKey] || [];

    if (messages.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'This is the beginning of the dialogue';
      messageList.appendChild(emptyMessage);
      return;
    }

    let dividerInserted = false;

    messages.forEach((msg) => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${msg.from === from ? 'sent' : 'received'}`;

      if (showUnreadDivider && !dividerInserted && msg.from === to && !msg.status.isReaded) {
        const divider = document.createElement('div');
        divider.className = 'unread-divider';
        divider.textContent = 'Unread messages';
        messageList.appendChild(divider);
        dividerInserted = true;
      }

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
      textSpan.textContent = msg.status?.isDeleted ? 'Message deleted' : msg.text;
      textSpan.className = 'message-text';
      messageDiv.appendChild(textSpan);

      if (msg.status?.isEdited && !msg.status?.isDeleted) {
        const editedSpan = document.createElement('span');
        editedSpan.className = 'edited-status';
        editedSpan.textContent = ' (Edited)';
        messageDiv.appendChild(editedSpan);
      }

      if (msg.from === from && !msg.status?.isDeleted) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
          const deleteRequest = {
            id: crypto.randomUUID(),
            type: 'MSG_DELETE',
            payload: {
              message: { id: msg.id },
            },
          };
          ws.send(JSON.stringify(deleteRequest));
        });
        messageDiv.appendChild(deleteBtn);

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
          messageInput.value = msg.text;
          messageInput.focus();
          editingMessageId = msg.id;
        });
        messageDiv.appendChild(editBtn);

        const statusSpan = document.createElement('span');
        statusSpan.className = 'message-status';
        if (msg.status.isReaded) {
          statusSpan.textContent = 'Read';
        } else if (msg.status.isDelivered) {
          statusSpan.textContent = 'Delivered';
        } else {
          statusSpan.textContent = 'Sent';
        }
        messageDiv.appendChild(statusSpan);
      }

      messageList.appendChild(messageDiv);
    });

    messageList.scrollTop = messageList.scrollHeight;
  }

  if (wsMessageHandler) {
    ws.removeEventListener('message', wsMessageHandler);
  }

  wsMessageHandler = (event: MessageEvent): void => {
    const data = JSON.parse(event.data);

    if (data.type === 'MSG_SEND') {
      const msg = data.payload?.message;
      if (!msg) return;

      const msgChatKey = getChatKey(msg.from, msg.to);

      if (!messagesByChat[msgChatKey]) {
        messagesByChat[msgChatKey] = [];
      }
      messagesByChat[msgChatKey].push(msg);

      if (msgChatKey === currentChatKey) {
        renderMessages();
        markMessagesAsRead();
      }
    } else if (data.type === 'MSG_FROM_USER') {
      const msgs = data.payload?.messages || [];

      msgs.forEach((msg: Message) => {
        const msgChatKey = getChatKey(msg.from, msg.to);
        if (!messagesByChat[msgChatKey]) {
          messagesByChat[msgChatKey] = [];
        }
        if (!messagesByChat[msgChatKey].find((m) => m.id === msg.id)) {
          messagesByChat[msgChatKey].push(msg);
        }
      });

      if (currentChatKey && messagesByChat[currentChatKey]) {
        showUnreadDivider = true;
        renderMessages();
      }
    } else if (data.type === 'MSG_DELETE') {
      const deletedMsg = data.payload?.message;
      if (!deletedMsg?.id) return;

      Object.keys(messagesByChat).forEach((key) => {
        const index = messagesByChat[key].findIndex((m) => m.id === deletedMsg.id);
        if (index !== -1) {
          messagesByChat[key][index].status.isDeleted = true;
          if (key === currentChatKey) {
            renderMessages();
          }
        }
      });
    } else if (data.type === 'MSG_EDIT') {
      const editedMsg = data.payload?.message;
      if (!editedMsg?.id) return;

      Object.keys(messagesByChat).forEach((key) => {
        const index = messagesByChat[key].findIndex((m) => m.id === editedMsg.id);
        if (index !== -1) {
          messagesByChat[key][index].text = editedMsg.text;
          messagesByChat[key][index].status.isEdited = true;
          if (editingMessageId === editedMsg.id) {
            editingMessageId = null;
          }
          if (key === currentChatKey) {
            renderMessages();
          }
        }
      });
    } else if (data.type === 'MSG_DELIVER') {
      const deliveredMsg = data.payload?.message;
      if (!deliveredMsg?.id) return;

      Object.keys(messagesByChat).forEach((key) => {
        const index = messagesByChat[key].findIndex((m) => m.id === deliveredMsg.id);
        if (index !== -1) {
          messagesByChat[key][index].status.isDelivered = true;
          if (key === currentChatKey) {
            renderMessages();
          }
        }
      });
    } else if (data.type === 'MSG_READ') {
      const readMsg = data.payload?.message;
      if (!readMsg?.id) return;

      Object.keys(messagesByChat).forEach((key) => {
        const index = messagesByChat[key].findIndex((m) => m.id === readMsg.id);
        if (index !== -1) {
          messagesByChat[key][index].status.isReaded = true;
          if (key === currentChatKey) {
            renderMessages();
          }
        }
      });
    }
  };

  ws.addEventListener('message', wsMessageHandler);

  function removeUnreadDivider(): void {
    if (!showUnreadDivider || !selectedUser || !to) return;

    showUnreadDivider = false;

    const messages = messagesByChat[chatKey] || [];
    messages.forEach((msg) => {
      if (msg.to === from && msg.from === to && !msg.status.isReaded) {
        ws.send(
          JSON.stringify({
            id: crypto.randomUUID(),
            type: 'MSG_READ',
            payload: {
              message: { id: msg.id },
            },
          }),
        );
      }
    });

    renderMessages();
  }

  function markMessagesAsRead(): void {
    if (!selectedUser || !to) return;

    const messages = messagesByChat[chatKey] || [];
    messages.forEach((msg) => {
      if (msg.to === from && msg.from === to && !msg.status.isReaded) {
        const readRequest = {
          id: crypto.randomUUID(),
          type: 'MSG_READ',
          payload: {
            message: { id: msg.id },
          },
        };
        ws.send(JSON.stringify(readRequest));
      }
    });
  }

  function handleSendButtonClick(): void {
    if (selectedUser && messageInput.value.trim() && to) {
      sendMessage(messageInput.value.trim(), to);
    }
  }

  function handleMessageInputKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && selectedUser && messageInput.value.trim() && to) {
      sendMessage(messageInput.value.trim(), to);
    }
  }

  if (eventListeners.sendButton) {
    sendButton.removeEventListener('click', eventListeners.sendButton);
  }
  if (eventListeners.messageInput) {
    messageInput.removeEventListener('keydown', eventListeners.messageInput);
  }

  eventListeners.sendButton = handleSendButtonClick;
  eventListeners.messageInput = handleMessageInputKeydown;

  if (to) {
    sendButton.addEventListener('click', handleSendButtonClick);
    messageInput.addEventListener('keydown', handleMessageInputKeydown);
    messageList.addEventListener('scroll', removeUnreadDivider);
    messageList.addEventListener('click', removeUnreadDivider);
    sendButton.addEventListener('click', removeUnreadDivider);
  }

  if (selectedUser && to) {
    loadMessageHistory(selectedUser.login);
  }
}
