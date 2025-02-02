<p align="center">
    <img src="https://raw.githubusercontent.com/adebola-io/unfinished/refs/heads/main/icon.svg" width="200" alt="unfinished logo">
</p>

# unfinished

[![downloads (@adbl/unfinished)](https://img.shields.io/npm/dm/@adbl/unfinished?label=downloads)](https://www.npmjs.com/package/@adbl/unfinished)

`unfinished` is a client-side library for building web apps. Like React, it allows you to use JSX to create dynamic user interfaces.

If you've worked with HTML, CSS, and JavaScript, `unfinished` should be easy to pick up. It is designed to help you build applications quickly and efficiently.

## Table of Contents

- [unfinished](#unfinished)
  - [Table of Contents](#table-of-contents)
  - [Key Features](#key-features)
  - [Installation](#installation)
  - [Documentation](#documentation)
  - [License](#license)
  - [Contributing](#contributing)

## Key Features

Here's a breakdown of the core functionalities:

- **Lightweight:** `unfinished` has a small footprint, which means it loads quickly without extra overhead.

- **JSX Support:** You can use JSX to define your user interfaces. This allows you embed HTML-like structures directly into JavaScript.

- **Built-in Reactivity:** `@adbl/cells` is used for reactivity. This means that parts of your UI that depend on data will automatically update, without the need for manual triggering or rerenders.

- **Components are DOM Elements:** Components in `unfinished` are just standard DOM nodes. There is no extra layer. This gives you a high level of control and interoperability with existing DOM APIs.

- **Built-in Router:** The library includes its own router, which makes it easier to build single-page applications. The router handles navigation between parts of your app without full page reloads.

- **(Experimental) Hot Module Reload Support:** `unfinished` supports hot module reloads, which allow you to see changes instantly without refreshing the page. This speeds up development by letting you focus more on your application.

## Installation

> `NOTE`: This section assumes you already have Node.js and npm installed on your machine. If you don't, you can download them from the official [Node.js website](https://nodejs.org/en/).

To get started with `unfinished`, you'll need to create a new project using our scaffolding tool.

This will set up the basic project structure for you. Then, you'll need to install dependencies and start the development server.

- **Create a new project:**

  Open your terminal in your documents directory, and run the following command:

  ```bash
  npx @adbl/unfinished-start
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

You can learn more about `unfinished` by reading the [documentation](https://github.com/adebola-io/unfinished/blob/main/docs/README.md).

## License

`unfinished` is licensed under the [MIT License](https://github.com/adebola-io/unfinished/blob/main/LICENSE).

## Contributing

Contributions are welcome! Please read the [contributing guidelines](https://github.com/adebola-io/unfinished/blob/main/CONTRIBUTING.md) for more information.
