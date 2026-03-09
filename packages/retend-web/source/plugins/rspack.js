const loader = new URL('./rspack-loader.cjs', import.meta.url).pathname;

/**
 * Minimal compiler shape used by the Retend Rspack plugin.
 *
 * The plugin only mutates `module.rules`, adding:
 * - a pre-loader for Retend HMR instrumentation in development
 * - a default SWC JSX rule when the app has not already defined one
 *
 * App-specific concerns such as `entry`, `HtmlRspackPlugin`, aliases, and
 * additional loaders stay in the consumer config.
 *
 * @typedef {{
 *  apply(compiler: { options: { module?: { rules?: unknown[] } } }): void
 * }} RsPackPluginLike
 */

/**
 * Retend plugin for Rspack.
 *
 * This keeps the consumer config small by providing the Retend-specific
 * module rules needed for JSX compilation and component HMR. If a SWC rule
 * already exists, the plugin leaves it in place and only adds the Retend
 * HMR pre-loader.
 *
 * @returns {RsPackPluginLike}
 */
export const pluginRetend = () => {
  return {
    apply(compiler) {
      compiler.options.module ??= {};
      compiler.options.module.rules ??= [];
      const rules = compiler.options.module.rules;
      const hasSwcRule = rules.some((rule) => {
        if (!rule || typeof rule !== 'object') return false;
        if ('loader' in rule) return rule.loader === 'builtin:swc-loader';
        if ('use' in rule && Array.isArray(rule.use)) {
          return rule.use.some((entry) => {
            return (
              entry &&
              typeof entry === 'object' &&
              'loader' in entry &&
              entry.loader === 'builtin:swc-loader'
            );
          });
        }
        return false;
      });
      rules.unshift({
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: [{ loader }],
      });
      if (!hasSwcRule) {
        rules.push({
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                  importSource: 'retend',
                },
              },
            },
          },
        });
      }
    },
  };
};
