/** Process-wide native system integration options for a Retend GPUI application. */
export interface GpuiSystemOptions {
  /**
   * Makes the native system titlebar transparent so application content can
   * extend behind the window controls. Supported by GPUI on macOS and Windows.
   */
  transparentTitlebar?: boolean;
}
