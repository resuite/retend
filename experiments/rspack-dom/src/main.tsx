import 'retend-web/jsx-runtime';
import { renderToDOM } from 'retend-web';
import { RetendDevTools } from 'retend-web-devtools';

import App from './App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root not found');
}

renderToDOM(root, () => {
  return (
    <RetendDevTools>
      <App />
    </RetendDevTools>
  );
});
