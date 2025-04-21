import { document, window } from '../browserTypes';
import { renderApp } from './main';
import { checkAuth } from './main';

export function renderAboutPage(fromPage: 'auth' | 'main'): void {
  const body = document.body;
  body.innerHTML = '';

  const aboutPage = document.createElement('div');
  aboutPage.className = 'about-page';

  const aboutContainer = document.createElement('div');
  aboutContainer.className = 'about-container';

  const title = document.createElement('h1');
  title.textContent = 'funChat';
  aboutContainer.appendChild(title);

  const description = document.createElement('p');
  description.textContent =
    'The task was completed as part of the RSSchool JS/FE 2024Q4 course';
  aboutContainer.appendChild(description);

  const author = document.createElement('p');
  author.textContent = 'Completed by Squaller';
  aboutContainer.appendChild(author);

  const backButton = document.createElement('button');
  backButton.textContent = 'Go back';
  backButton.className = 'back-button';
  backButton.addEventListener('click', () => {
    const targetPath = fromPage === 'auth' || !checkAuth() ? '/login' : '/main';
    window.history.pushState({}, '', targetPath);
    renderApp();
  });
  aboutContainer.appendChild(backButton);

  aboutPage.appendChild(aboutContainer);
  body.appendChild(aboutPage);
}
