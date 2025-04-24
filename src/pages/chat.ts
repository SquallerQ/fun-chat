import {
  document,
  crypto,
  WebSocket,
  KeyboardEvent,
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
    isDeleted: boolean;
  };
}
const eventListeners: {
  sendButton?: () => void;
  // eslint-disable-next-line no-unused-vars
  messageInput?: (e: KeyboardEvent) => void;
} = {};

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
  const targetUser = to;
  let messages: Message[] = [];
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

    const filteredMessages = targetUser
      ? messages.filter(
          (msg) =>
            (msg.from === from && msg.to === targetUser) ||
            (msg.from === targetUser && msg.to === from),
        )
      : [];

    if (filteredMessages.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'This is the beginning of the dialogue';
      messageList.appendChild(emptyMessage);
      return;
    }

    let dividerInserted = false;

    filteredMessages.forEach((msg) => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${msg.from === from ? 'sent' : 'received'}`;

      if (
        showUnreadDivider &&
        !dividerInserted &&
        msg.from === targetUser &&
        !msg.status.isReaded
      ) {
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
      textSpan.textContent = msg.status?.isDeleted
        ? 'Message deleted'
        : msg.text;
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

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'MSG_SEND') {
      const msg = data.payload?.message;
      if (msg) {
        messages.push(msg);
        if (
          targetUser &&
          ((msg.from === from && msg.to === targetUser) ||
            (msg.from === targetUser && msg.to === from))
        ) {
          renderMessages();
          markMessagesAsRead();
        }
      }
    } else if (data.type === 'MSG_FROM_USER') {
      const msgs = data.payload?.messages || [];
      if (targetUser) {
        messages = msgs.filter(
          (msg: Message) =>
            (msg.from === from && msg.to === targetUser) ||
            (msg.from === targetUser && msg.to === from),
        );
      } else {
        messages = msgs;
      }
      showUnreadDivider = true;
      renderMessages();
    } else if (data.type === 'MSG_DELETE') {
      const deletedMsg = data.payload?.message;
      if (deletedMsg?.id) {
        const index = messages.findIndex((m) => m.id === deletedMsg.id);
        if (index !== -1) {
          messages[index].status.isDeleted = true;
          if (targetUser) renderMessages();
        }
      }
    } else if (data.type === 'MSG_EDIT') {
      const editedMsg = data.payload?.message;
      if (editedMsg?.id) {
        const index = messages.findIndex((m) => m.id === editedMsg.id);
        if (index !== -1) {
          messages[index].text = editedMsg.text;
          messages[index].status.isEdited = true;
          if (editingMessageId === editedMsg.id) {
            editingMessageId = null;
          }
          if (targetUser) renderMessages();
        }
      }
    } else if (data.type === 'MSG_DELIVER') {
      const deliveredMsg = data.payload?.message;
      if (deliveredMsg?.id) {
        const index = messages.findIndex((m) => m.id === deliveredMsg.id);
        if (index !== -1) {
          messages[index].status.isDelivered = true;
          if (
            targetUser &&
            ((messages[index].from === from &&
              messages[index].to === targetUser) ||
              (messages[index].from === targetUser &&
                messages[index].to === from))
          ) {
            renderMessages();
          }
        }
      }
    } else if (data.type === 'MSG_READ') {
      const readMsg = data.payload?.message;
      if (readMsg?.id) {
        const index = messages.findIndex((m) => m.id === readMsg.id);
        if (index !== -1) {
          messages[index].status.isReaded = true;
          if (
            targetUser &&
            ((messages[index].from === from &&
              messages[index].to === targetUser) ||
              (messages[index].from === targetUser &&
                messages[index].to === from))
          ) {
            renderMessages();
          }
        }
      }
    }
  });

  function removeUnreadDivider(): void {
    if (!showUnreadDivider || !selectedUser || !targetUser) return;

    showUnreadDivider = false;

    messages.forEach((msg) => {
      if (msg.to === from && msg.from === targetUser && !msg.status.isReaded) {
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
    if (!selectedUser || !targetUser) return;

    messages.forEach((msg) => {
      if (msg.to === from && msg.from === targetUser && !msg.status.isReaded) {
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
    if (selectedUser && messageInput.value.trim() && targetUser) {
      sendMessage(messageInput.value.trim(), targetUser);
    }
  }

  function handleMessageInputKeydown(e: KeyboardEvent): void {
    if (
      e.key === 'Enter' &&
      selectedUser &&
      messageInput.value.trim() &&
      targetUser
    ) {
      sendMessage(messageInput.value.trim(), targetUser);
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

  if (targetUser) {
    sendButton.addEventListener('click', handleSendButtonClick);
    messageInput.addEventListener('keydown', handleMessageInputKeydown);
    messageList.addEventListener('scroll', removeUnreadDivider);
    messageList.addEventListener('click', removeUnreadDivider);
    sendButton.addEventListener('click', removeUnreadDivider);
  }

  if (selectedUser && targetUser) {
    loadMessageHistory(selectedUser.login);
  }
}
