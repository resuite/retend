import { rspack } from '@rspack/core';
import { pluginRetend } from 'retend-web/plugins/rspack';

export default {
  plugins: [
    pluginRetend(),
    new rspack.HtmlRspackPlugin({
      template: './index.html',
    }),
  ],
};
