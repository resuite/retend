import { Cell } from 'retend';

export function useLiveDate() {
  const now = Cell.source(new Date());

  setInterval(() => {
    now.value = new Date();
  }, 1000);

  return now;
}
