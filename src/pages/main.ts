import githubIcon from '../assets/github.svg';
import rsSchoolLogo from '../assets/rss-logo.svg';
import { getWS } from '../wsManager';

import { renderAboutPage } from './about';
import { renderAuthPage } from './auth';

import { initializeChat } from './chat';

interface User {
  login: string;
  online: boolean;
}

export function renderApp(): void {
  const currentPath = window.location.pathname;

  if (currentPath === '/login') {
    renderAuthPage();
  } else if (currentPath === '/about') {
    renderAboutPage(checkAuth() ? 'main' : 'auth');
  } else {
    if (checkAuth()) {
      renderMainPage();
    } else {
      window.history.pushState({}, '', '/login');
      renderAuthPage();
    }
  }
}

export function renderMainPage(): void {
  const body = document.body;
  body.innerHTML = '';

  const mainPage = document.createElement('div');
  mainPage.className = 'main-page';

  const header = document.createElement('header');
  header.className = 'header';

  const appName = document.createElement('h1');
  appName.textContent = 'Fun Chat';
  header.appendChild(appName);

  const userName = document.createElement('span');
  const login = sessionStorage.getItem('login');
  if (login) {
    userName.textContent = `Welcome, ${login}!`;
  } else {
    userName.textContent = 'Welcome, User!';
  }
  userName.className = 'header-user-name';
  header.appendChild(userName);

  const infoBtn = document.createElement('button');
  infoBtn.textContent = 'Info';
  infoBtn.className = 'info-btn-main';
  infoBtn.addEventListener('click', () => {
    window.history.pushState({}, '', '/about');
    renderApp();
  });
  header.appendChild(infoBtn);

  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'Logout';
  logoutBtn.className = 'logout-btn';

  header.appendChild(logoutBtn);

  mainPage.appendChild(header);

  const content = document.createElement('div');
  content.className = 'content';

  const userListContainer = document.createElement('div');
  userListContainer.className = 'user-list-container';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search users...';
  searchInput.className = 'search-input';
  userListContainer.appendChild(searchInput);

  const userList = document.createElement('ul');
  userList.className = 'user-list';
  userListContainer.appendChild(userList);

  content.appendChild(userListContainer);

  const dialogContainer = document.createElement('div');
  dialogContainer.className = 'dialog-container';

  const dialogHeader = document.createElement('div');
  dialogHeader.className = 'dialog-header';
  dialogHeader.textContent = 'Select a user to start chatting';
  dialogContainer.appendChild(dialogHeader);

  const messageList = document.createElement('div');
  messageList.className = 'message-list';
  dialogContainer.appendChild(messageList);

  const messageInputContainer = document.createElement('div');
  messageInputContainer.className = 'message-input-container';

  const messageInput = document.createElement('input');
  messageInput.type = 'text';
  messageInput.placeholder = 'Type a message...';
  messageInput.className = 'message-input';
  messageInput.disabled = true;
  messageInputContainer.appendChild(messageInput);

  const sendButton = document.createElement('button');
  sendButton.textContent = 'Send';
  sendButton.className = 'send-button';
  sendButton.disabled = true;
  messageInputContainer.appendChild(sendButton);

  dialogContainer.appendChild(messageInputContainer);
  content.appendChild(dialogContainer);

  mainPage.appendChild(content);

  const footer = document.createElement('footer');
  footer.className = 'footer';

  const schoolInfoContainer = document.createElement('div');
  schoolInfoContainer.className = 'school-container';

  const schoolLogo = document.createElement('img');
  schoolLogo.src = rsSchoolLogo;
  schoolLogo.alt = 'Rolling Scopes School';
  schoolLogo.className = 'school-icon';
  schoolInfoContainer.appendChild(schoolLogo);

  const schoolName = document.createElement('span');
  schoolName.textContent = 'Rolling Scopes School';
  schoolName.className = 'school-name';
  schoolInfoContainer.appendChild(schoolName);

  footer.appendChild(schoolInfoContainer);

  const githubContainer = document.createElement('div');
  githubContainer.className = 'github-container';

  const githubLink = document.createElement('a');
  githubLink.href = 'https://github.com/squallerq';
  githubLink.target = '_blank';
  githubContainer.appendChild(githubLink);

  const githubIconImg = document.createElement('img');
  githubIconImg.src = githubIcon;
  githubIconImg.alt = 'GitHub';
  githubIconImg.className = 'github-icon';
  githubLink.appendChild(githubIconImg);

  const authorName = document.createElement('span');
  authorName.textContent = 'Squaller';
  authorName.className = 'author-name';
  githubContainer.appendChild(authorName);

  footer.appendChild(githubContainer);

  const year = document.createElement('span');
  year.textContent = '2025';
  year.className = 'year';
  footer.appendChild(year);

  mainPage.appendChild(footer);

  body.appendChild(mainPage);

  let users: User[] = [];
  let selectedUser: User | null = null;

  let unreadMap: Record<string, number> = {};
  const currentLogin = sessionStorage.getItem('login') || '';

  const ws = getWS();

  ws.onopen = (): void => {
    const login = sessionStorage.getItem('login');
    const password = sessionStorage.getItem('password');

    if (login && password) {
      const loginRequest = {
        id: crypto.randomUUID(),
        type: 'USER_LOGIN',
        payload: {
          user: { login, password },
        },
      };
      ws.send(JSON.stringify(loginRequest));
    }

    setTimeout(() => {
      initializeChat(ws, users, selectedUser, messageList, messageInput, sendButton, currentLogin, '');

      const activeRequest = {
        id: crypto.randomUUID(),
        type: 'USER_ACTIVE',
        payload: { user: { login } },
      };
      ws.send(JSON.stringify(activeRequest));

      const inactiveRequest = {
        id: crypto.randomUUID(),
        type: 'USER_INACTIVE',
        payload: null,
      };
      ws.send(JSON.stringify(inactiveRequest));
    }, 200);
  };

  ws.onmessage = (event): void => {
    const data = JSON.parse(event.data);

    if (data.type === 'USER_ACTIVE') {
      const activeUsers =
        data.payload?.users?.map((user: { login: string; isLogined: boolean }) => ({
          login: user.login,
          online: user.isLogined,
        })) || [];
      activeUsers.forEach((activeUser: User) => {
        const existingUser = users.find((u) => u.login === activeUser.login);
        if (existingUser) {
          existingUser.online = true;
        } else {
          users.push(activeUser);
        }
      });
      const currentLogin = sessionStorage.getItem('login');
      if (currentLogin && !users.find((u) => u.login === currentLogin)) {
        users.push({ login: currentLogin, online: true });
      }
      renderUserList(users, searchInput.value);
    } else if (data.type === 'USER_INACTIVE') {
      const inactiveUsers =
        data.payload?.users?.map((user: { login: string; isLogined: boolean }) => ({
          login: user.login,
          online: user.isLogined,
        })) || [];

      inactiveUsers.forEach((inactiveUser: User) => {
        const existingUser = users.find((u) => u.login === inactiveUser.login);
        if (existingUser) {
          existingUser.online = false;
        } else {
          users.push({ login: inactiveUser.login, online: false });
        }
      });
      renderUserList(users, searchInput.value);
    } else if (data.type === 'MSG_SEND') {
      const msg = data.payload?.message;
      if (
        msg &&
        msg.to === currentLogin &&
        !msg.status.isReaded &&
        !msg.status.isDeleted &&
        msg.from !== selectedUser?.login
      ) {
        unreadMap[msg.from] = (unreadMap[msg.from] || 0) + 1;
        renderUserList(users, searchInput.value);
      }
    } else if (data.type === 'MSG_READ') {
      const readMsg = data.payload?.message;
      if (readMsg?.id && readMsg.from !== currentLogin && !readMsg.status.isDeleted && unreadMap[readMsg.from] > 0) {
        unreadMap[readMsg.from]--;
        if (unreadMap[readMsg.from] <= 0) {
          delete unreadMap[readMsg.from];
        }
        renderUserList(users, searchInput.value);
      }
    }
  };

  ws.onerror = (): void => {
    console.log('onError: Error');
  };

  setInterval(() => {
    const activeRequest = {
      id: crypto.randomUUID(),
      type: 'USER_ACTIVE',
      payload: null,
    };
    ws.send(JSON.stringify(activeRequest));

    const inactiveRequest = {
      id: crypto.randomUUID(),
      type: 'USER_INACTIVE',
      payload: null,
    };
    ws.send(JSON.stringify(inactiveRequest));
  }, 1000);

  logoutBtn.addEventListener('click', () => {
    const login = sessionStorage.getItem('login');
    const password = sessionStorage.getItem('password');

    if (login && password) {
      const logoutMessage = {
        id: crypto.randomUUID(),
        type: 'USER_LOGOUT',
        payload: {
          user: {
            login,
            password,
          },
        },
      };
      ws.send(JSON.stringify(logoutMessage));
    }

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('login');
    sessionStorage.removeItem('password');
    ws.close();
    window.history.pushState({}, '', '/login');
    renderApp();
  });

  function renderUserList(usersToShow: User[], searchQuery: string): void {
    userList.innerHTML = '';
    const query = searchQuery.toLowerCase();
    const currentLogin = sessionStorage.getItem('login') || '';

    for (const user of usersToShow) {
      if (user.login === currentLogin) {
        continue;
      }
      if (query && !user.login.toLowerCase().includes(query)) {
        continue;
      }

      const li = document.createElement('li');
      li.className = 'user-item';
      li.setAttribute('data-login', user.login);
      li.addEventListener('click', () => {
        selectedUser = user;
        unreadMap[user.login] = 0;
        delete unreadMap[user.login];
        updateDialogHeader();
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageList.innerHTML = '';
        initializeChat(
          ws,
          users,
          selectedUser,
          messageList,
          messageInput,
          sendButton,
          currentLogin,
          selectedUser.login,
        );
      });

      const name = document.createElement('span');
      name.textContent = user.login;
      name.className = 'user-name';
      li.appendChild(name);

      const badge = document.createElement('span');
      badge.className = 'unread-indicator';
      const unreadCount = unreadMap[user.login] || 0;
      badge.textContent = unreadCount > 0 ? String(unreadCount) : '';
      badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
      li.appendChild(badge);

      const status = document.createElement('span');
      if (user.online) {
        status.textContent = 'Online';
        status.className = 'user-status online';
      } else {
        status.textContent = 'Offline';
        status.className = 'user-status offline';
      }
      li.appendChild(status);

      userList.appendChild(li);
    }
  }

  function updateDialogHeader(): void {
    if (selectedUser) {
      dialogHeader.textContent = `${selectedUser.login} (${selectedUser.online ? 'Online' : 'Offline'})`;
    } else {
      dialogHeader.textContent = 'Select a user to start chatting';
      messageInput.disabled = true;
      sendButton.disabled = true;
    }
  }

  searchInput.addEventListener('input', () => {
    renderUserList(users, searchInput.value);
  });
}

export function checkAuth(): boolean {
  const token = sessionStorage.getItem('token');
  if (token) {
    return true;
  } else {
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderApp();

  window.addEventListener('popstate', () => {
    renderApp();
  });
});
