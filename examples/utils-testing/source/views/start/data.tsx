// Export a simple serializable value
export const buildEnvironment = process.env.NODE_ENV || 'development';

// Export a Date (will be serialized/deserialized)
export const generatedAt = new Date();

export const listOfItems = ['foo', 'bar', 'baz'];
