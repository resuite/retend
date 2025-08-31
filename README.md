# retend

> **Retend is not ready for any production use. Implement it at your own discretion.**

Retend is a experimental framework for building fluid web apps. Like React, it allows you to use JSX to create dynamic user interfaces.

If you've worked with HTML, CSS, and JavaScript, Retend should be easy to pick up. It is designed to help you build applications quickly and efficiently.

## Key Features

Here's a breakdown of the core functionalities:

- **Lightweight:** Retend has a small footprint, which means it loads quickly without extra overhead.

- **JSX Support:** You can use JSX to define your user interfaces. This allows you embed HTML-like structures directly into JavaScript.

- **Built-in Reactivity:** [`@adbl/cells`](https://github.com/adebola-io/cells) is used for reactivity. This means that parts of your UI that depend on data will automatically update, without the need for manual triggering or rerenders.

- **Components are DOM Elements:** Components in Retend are just functions that return elements.

  - There is no extra layer.
  - There is no Virtual DOM.
  - There is no "re-render".

  This gives you a high level of control and interoperability with existing DOM APIs.

- **Built-in Router:** Retend includes its own router, which makes it easier to build single-page applications. The router handles navigation between parts of your app without full page reloads.

- **(Experimental) HMR Support:** Retend supports hot module reloads, which allow you to see changes instantly without refreshing the page. This speeds up development by letting you focus more on your application.

- **(Experimental) SSG support:** Retends supports statically generating a select group of paths of your application.

## Installation

> `NOTE`: This section assumes you already have Node.js and npm installed on your machine. If you don't, you can download them from the official [Node.js website](https://nodejs.org/en/).

To get started with Retend, you'll need to create a new project using the scaffolding tool.

This will set up the basic project structure for you. Then, you'll need to install dependencies and start the development server.

- **Create a new project:**

  Open your terminal in your documents directory, and run the following command:

  ```bash
  npx retend-start@latest
  ```

  This command will prompt you for some details about your project and generate the necessary project files.

  You can also use the following options to configure the project:

  - `--name`: The name of the project (defaults to `my-app`).
  - `--tailwind`: Whether to use Tailwind CSS (defaults to `false`).
  - `--scss`: Whether to use SCSS (defaults to `CSS`). If set, SCSS will be used as the CSS preprocessor.
  - `--javascript`: Whether to use JavaScript (defaults to `JavaScript`). If set, JavaScript will be used as the language. Otherwise, TypeScript will be used.
  - `--ssg`: Whether to use Static Site Generation (SSG) (defaults to `false`).

  For example:

  ```bash
  npx retend-start my-app --tailwind --scss --javascript --ssg
  ```

  This command will create a new project named `my-app` with Tailwind CSS, SCSS, JavaScript, and SSG enabled.

  You can also use the `--default` flag to use the default options:

  ```bash
  npx retend-start --default
  ```

  This command will create a new project named `my-app` with the default options (no Tailwind CSS, CSS, JavaScript, and no SSG).

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
