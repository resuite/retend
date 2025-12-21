# retend

[![npm version](https://img.shields.io/npm/v/retend?color=blue)](https://www.npmjs.com/package/retend)

Retend is a engine for building reactive user interfaces using JSX. It provides a core set of primitives for state management, reconciliation, and rendering, designed to be fast and lightweight.

## Key Features

- **Lightweight & Modular:** Retend is built with a small footprint, focusing on the essential logic for reactive updates without imposing a heavy runtime.
- **JSX Support:** Define your UI using familiar JSX syntax. Retend's engine handles the transformation into efficient update instructions.
- **Fine-grained Reactivity:** Powered by [`@adbl/cells`](https://github.com/adebola-io/cells), Retend ensures that only the necessary parts of your UI update when data changes.
- **Abstract Core Engine:** Retend's architecture uses an abstract `Renderer` interface. While primarily designed for the web, this decoupling allows for high efficiency and future extensibility.
- **Built-in Router:** Includes a flexible routing system for managing application state and navigation.
- **(Experimental) Fast Refresh Support:** Designed to support hot module reloads for a seamless development experience.

## Usage

Retend is typically used with a renderer. The primary and recommended renderer is [**`retend-web`**](https://github.com/resuite/retend/tree/main/packages/retend-web), which targets the browser DOM.

> `NOTE`: While the core engine's abstract nature allows for targeting other environments (like static generation), these use cases are currently experimental and have not been fully tested.

## Installation

> `NOTE`: This section assumes you already have Node.js and npm installed on your machine. If you don't, you can download them from the official [Node.js website](https://nodejs.org/en/).

To get started with Retend, you'll need to create a new project using our scaffolding tool.

This will set up the basic project structure for you. Then, you'll need to install dependencies and start the development server.

- **Create a new project:**

  Open your terminal in your documents directory, and run the following command:

  ```bash
  npx retend-start
  ```

  This command will prompt you for some details about your project (such as the name, if you want to use Tailwind etc.) and will generate the necessary project files.

- **Navigate to your project directory:**

  After creating the project, navigate into the project by using `cd` and the name you used:

  ```shell
  cd your-project-name
  ```

- **Install dependencies:**

  Run the following command to install all the required packages for your project:

  ```bash
  npm install
  ```

- **Start the development server:**

  Finally, start the development server using this command in the same directory:

  ```bash
  npm run dev
  ```

  This command will start a local development server, and you'll be able to see your application at `http://localhost:5229` in your browser.

## Documentation

You can learn more about Retend by reading the [documentation](https://github.com/adebola-io/retend/blob/main/docs/README.md).

## License

Retend is licensed under the [MIT License](https://github.com/adebola-io/retend/blob/main/LICENSE).

## Contributing

Contributions are welcome! Please read the [contributing guidelines](https://github.com/adebola-io/retend/blob/main/CONTRIBUTING.md) for more information.
