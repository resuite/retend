import 'retend/jsx-runtime';
import type {
  CanvasContainer,
  CanvasContainerProps,
  CanvasShapeProps,
  CanvasPathProps,
  CanvasImageProps,
  CanvasParticlesProps,
} from '../types';

declare module 'retend/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      img: CanvasContainer<CanvasImageProps>;
      rect: CanvasContainer<CanvasContainerProps>;
      circle: CanvasContainer<CanvasContainerProps>;
      shape: CanvasContainer<CanvasShapeProps>;
      path: CanvasContainer<CanvasPathProps>;
      text: CanvasContainer<CanvasContainerProps>;
      particles: CanvasContainer<CanvasParticlesProps>;
    }
  }
}
