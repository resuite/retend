import { getGlobalContext } from 'retend/context';
import { renderToString } from 'retend/render';

// Export a simple serializable value
export const buildEnvironment = process.env.NODE_ENV || 'development';

// Export a Date (will be serialized/deserialized)
export const generatedAt = new Date();

export const listOfItems = ['foo', 'bar', 'baz'];

const { window } = getGlobalContext();
export const serializedDiv = await renderToString(
  <div>Hello World</div>,
  window
);
