import { rspack } from '@rspack/core';
import { pluginRetend } from 'retend-web/plugins/rspack';

export default {
  entry: './src/main.tsx',
  plugins: [
    pluginRetend(),
    new rspack.HtmlRspackPlugin({
      template: './index.html',
    }),
  ],
};
