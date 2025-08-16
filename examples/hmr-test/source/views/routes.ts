import { defineRoute } from 'retend/router';
import Start from '.';
import { NestedRoute } from './nested-route';

export const startRoute = defineRoute({
  name: 'Start View',
  path: '/',
  component: Start,
  children: [
    {
      path: '',
      component: NestedRoute
    }
  ]
});
