import 'retend-web/jsx-runtime';
import { hydrate } from 'retend-server/client';
import { RetendDevTools } from 'retend-web-devtools';

import './index.css';
import { createRouter } from '@/router';

hydrate(createRouter, {
  rootId: 'root',
  wrap(root) {
    return (
      // <RetendDevTools>
      <RetendDevTools>{root}</RetendDevTools>
      // </RetendDevTools>
    );
  },
});
