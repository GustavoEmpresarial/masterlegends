// Augment React JSX runtime with @react-three/fiber's three.js elements so
// <mesh>, <group>, <planeGeometry>, etc. type-check in any .tsx file.
import type { ThreeElements } from '@react-three/fiber';

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
