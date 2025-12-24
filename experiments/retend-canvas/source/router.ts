import { createWebRouter } from 'retend/router';
 import App from './App';

 export function createRouter() {
   return createWebRouter({ routes: [{ path: '/', component: App }] });
 }