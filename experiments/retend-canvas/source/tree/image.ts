import type { JSX } from 'retend/jsx-runtime';

import { Length } from '../style';
import { WARNING_IMAGE_CHILDREN, WARNING_IMAGE_SVG } from '../warnings';
import { CanvasContainer } from './container';

export class CanvasImage extends CanvasContainer<JSX.ImageProps> {
  protected imageBitmap: ImageBitmap | null = null;
  protected srcVersion = 0;

  override append() {
    console.warn(WARNING_IMAGE_CHILDREN);
  }

  override prepend() {
    console.warn(WARNING_IMAGE_CHILDREN);
  }

  override setAttribute<K extends keyof JSX.ImageProps>(
    key: K,
    value: JSX.ImageProps[K]
  ) {
    super.setAttribute(key, value);

    if (key === 'src') {
      const src = value as string | undefined;
      if (!src) {
        this.imageBitmap = null;
        this.dirtyPath = true;
        this.renderer.requestRender();
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
            this.dirtyPath = true;
            this.renderer.requestRender();
          }
        })
        .catch((err) => {
          console.error(`Failed to load image at src '${src}':`, err);
        });
    }
  }

  override tracePath(): Path2D | null {
    if (!this.dirtyPath && this.path) {
      return this.path;
    }

    const { borderRadius = Length.Px(0) } = this.style;
    const path = new Path2D();
    const radiusValue = borderRadius.value;
    if (!radiusValue) {
      path.rect(0, 0, this.width, this.height);
      this.path = path;
      this.dirtyPath = false;
      return path;
    }

    const radius = Math.min(radiusValue, this.width / 2, this.height / 2);
    path.roundRect(0, 0, this.width, this.height, radius);
    this.path = path;
    this.dirtyPath = false;
    return path;
  }

  override paintContainer(): void {
    this.paintPath();
    const host = this.renderer.host;

    if (this.imageBitmap) {
      host.ctx.drawImage(this.imageBitmap, 0, 0, this.width, this.height);
    }
  }
}
