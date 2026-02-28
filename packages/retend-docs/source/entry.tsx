import 'retend-web/jsx-runtime';
import { createRouter } from '@/router';
import { hydrate } from 'retend-server/client';
import './index.css';

hydrate(createRouter, { rootId: 'root' });
