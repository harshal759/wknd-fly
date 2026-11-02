import { isAuthorEnvironment } from '../../scripts/scripts.js';

export default function decorate(block) {
  const isAuthor = isAuthorEnvironment();
  block.textContent = isAuthor ? 'WebView' : '';
  block.classList.toggle('author-placeholder', isAuthor);
  if (isAuthor) block.removeAttribute('aria-hidden');
  else block.setAttribute('aria-hidden', 'true');
  block.hidden = !isAuthor;
}