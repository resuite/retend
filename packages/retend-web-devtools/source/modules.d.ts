declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
