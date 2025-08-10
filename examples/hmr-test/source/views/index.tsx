import { Cell } from 'retend';
import { Count } from './scopes.ts';
import { CountUpdate } from './count-update';

import { NestedChildComponent, SingleComponent } from './single-component';
import classes from './styles.module.css';
import { useRouter } from 'retend/router';

const Start = () => {
  const count = Cell.source(0);
  const router = useRouter();

  return (
    <Count.Provider value={count}>
      {() => (
        <div class={classes.startView}>
          <SingleComponent />
          <CountUpdate />
          <br />
          Separate instance of nested child:
          <NestedChildComponent />
          <br />
          Nested Route:
          <router.Outlet />
        </div>
      )}
    </Count.Provider>
  );
};

export default Start;
