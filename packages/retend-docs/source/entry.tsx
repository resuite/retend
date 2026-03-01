import 'retend-web/jsx-runtime';
import { hydrate } from 'retend-server/client';

import { createRouter } from '@/router';

import './index.css';

hydrate(createRouter, { rootId: 'root' });
