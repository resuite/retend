import type { FrameBuilder } from '../frame-builder';
import type { CanvasImageProps } from '../types';

import { WARNING_IMAGE_CHILDREN, WARNING_IMAGE_SVG } from '../warnings';
import { CanvasContainer } from './container';

export class CanvasImage extends CanvasContainer<CanvasImageProps> {
  protected imageBitmap: ImageBitmap | null = null;
  protected srcVersion = 0;

  override append() {
    console.warn(WARNING_IMAGE_CHILDREN);
  }

  override prepend() {
    console.warn(WARNING_IMAGE_CHILDREN);
  }

  override setAttribute<K extends keyof CanvasImageProps>(
    key: K,
    value: CanvasImageProps[K]
  ) {
    super.setAttribute(key, value);

    if (key === 'src') {
      const src = value as string | undefined;
      if (!src) {
        this.imageBitmap = null;
        if (this.isConnected) this.renderer.requestRender();
        return;
      }

      if (src.endsWith('.svg') || src.startsWith('data:image/svg+xml')) {
        console.warn(WARNING_IMAGE_SVG);
      }

      const currentVersion = ++this.srcVersion;

      fetch(src)
        .then((res) => res.blob())
        .then(createImageBitmap)
        .then((bitmap) => {
          if (this.srcVersion === currentVersion) {
            this.imageBitmap = bitmap;
            if (this.isConnected) this.renderer.requestRender();
          }
        })
        .catch((err) => {
          console.error(`Failed to load image at src '${src}':`, err);
        });
    }
  }

  override tracePath(): Path2D | null {
    return this.traceRoundedPath();
  }

  override paintContainer(frame: FrameBuilder): void {
    this.paintPath(frame);
    if (this.imageBitmap) {
      frame.pushImage(
        {
          image: this.imageBitmap,
          width: this.width,
          height: this.height,
        },
        this.id
      );
    }
  }
}
