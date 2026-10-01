// Generated for retend-gpui from the `application` option. Do not edit.
import type Application from './source/application.ts';

type ConfiguredAppContext = InstanceType<typeof Application>['context'];

declare module 'retend-gpui' {
  interface GpuiAppContextTypes {
    application: ConfiguredAppContext;
  }
}

export {};
