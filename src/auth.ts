import {
  document,
  sessionStorage,
  WebSocket,
  crypto,
  console,
} from './browserTypes';

import { setWS } from './wsManager';

import { renderMainPage } from './main';

export function renderAuthPage(): void {
  if (checkAuth()) return;

  const body = document.body;
  body.innerHTML = '';

  const authPage = document.createElement('div');
  authPage.className = 'auth-page';

  const title = document.createElement('h1');
  title.textContent = 'Login to Fun Chat';
  authPage.appendChild(title);

  const form = document.createElement('form');
  form.id = 'auth-form';

  const loginGroup = document.createElement('div');
  loginGroup.className = 'form-group';

  const loginLabel = document.createElement('label');
  loginLabel.htmlFor = 'login';
  loginLabel.textContent = 'Login:';
  loginGroup.appendChild(loginLabel);

  const loginInput = document.createElement('input');
  loginInput.type = 'text';
  loginInput.id = 'login';
  loginInput.placeholder = 'Enter your login';
  loginGroup.appendChild(loginInput);

  const loginError = document.createElement('span');
  loginError.id = 'login-error';
  loginError.className = 'error';
  loginGroup.appendChild(loginError);

  form.appendChild(loginGroup);

  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'form-group';

  const passwordLabel = document.createElement('label');
  passwordLabel.htmlFor = 'password';
  passwordLabel.textContent = 'Password:';
  passwordGroup.appendChild(passwordLabel);

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'password';
  passwordInput.placeholder = 'Enter your password';
  passwordGroup.appendChild(passwordInput);

  const passwordError = document.createElement('span');
  passwordError.id = 'password-error';
  passwordError.className = 'error';
  passwordGroup.appendChild(passwordError);

  form.appendChild(passwordGroup);

  const serverError = document.createElement('div');
  serverError.id = 'server-error';
  serverError.className = 'server-error';
  form.appendChild(serverError);

  const loginBtn = document.createElement('button');
  loginBtn.type = 'submit';
  loginBtn.id = 'login-btn';
  loginBtn.textContent = 'Login';
  loginBtn.disabled = true;
  form.appendChild(loginBtn);

  authPage.appendChild(form);
  body.appendChild(authPage);

  function validateLogin(value: string): string {
    if (value.length < 3) {
      return 'Login must be at least 3 characters long';
    }
    if (!/^[a-zA-Z0-9]+$/.test(value)) {
      return 'Login can only contain letters and numbers';
    }
    return '';
  }

  function validatePassword(value: string): string {
    if (value.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    if (!/[A-Z]/.test(value)) {
      return 'Password must contain at least one uppercase letter';
    }
    return '';
  }

  function updateButtonState(): void {
    const loginValid = !validateLogin(loginInput.value);
    const passwordValid = !validatePassword(passwordInput.value);
    const hasInput =
      loginInput.value.length > 0 && passwordInput.value.length > 0;
    loginBtn.disabled = !loginValid || !passwordValid || !hasInput;
  }

  loginInput.addEventListener('input', () => {
    const error = validateLogin(loginInput.value);
    loginError.textContent = error;
    loginInput.classList.toggle('error', !!error);
    serverError.textContent = '';
    updateButtonState();
  });

  passwordInput.addEventListener('input', () => {
    const error = validatePassword(passwordInput.value);
    passwordError.textContent = error;
    passwordInput.classList.toggle('error', !!error);
    serverError.textContent = '';
    updateButtonState();
  });

  function handleSubmit(): void {
    if (loginBtn.disabled) return;

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    serverError.textContent = '';

    const ws = new WebSocket('ws://localhost:4000');
    setWS(ws);

    ws.onopen = (): void => {
      const request = {
        id: crypto.randomUUID(),
        type: 'USER_LOGIN',
        payload: {
          user: {
            login: loginInput.value,
            password: passwordInput.value,
          },
        },
      };
      ws.send(JSON.stringify(request));
    };

    ws.onmessage = (event): void => {
      const data = JSON.parse(event.data);

      if (data.type === 'USER_LOGIN') {
        if (data.payload && data.payload.user && data.payload.user.isLogined) {
          sessionStorage.setItem('token', crypto.randomUUID());
          sessionStorage.setItem('login', loginInput.value);
          sessionStorage.setItem('password', passwordInput.value);
          renderMainPage();
        } else {
          serverError.textContent = 'Authentication failed: user not logged in';
          loginBtn.disabled = false;
          loginBtn.textContent = 'Login';
        }
      } else if (data.type === 'ERROR') {
        serverError.textContent = data.payload.error || 'Authentication failed';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
      } else {
        console.log('Unexpected response:', data);
      }
    };

    ws.onerror = (): void => {
      serverError.textContent = 'Connection to server failed';
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    };
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  });
}

function checkAuth(): boolean {
  const token = sessionStorage.getItem('token');

  if (token) {
    renderMainPage();
    return true;
  }
  return false;
}
