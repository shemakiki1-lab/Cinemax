// Lightweight local declarations to avoid needing node_modules/@types for editor checks.

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module 'react' {
  const React: any;
  export = React;
}
declare module 'react-dom' {
  const ReactDOM: any;
  export = ReactDOM;
}
declare module 'lucide-react' {
  const icons: any;
  export = icons;
}
declare module 'hls.js' {
  const hls: any;
  export default hls;
}
declare module 'react/jsx-runtime' {
  const jsx: any;
  export = jsx;
}

declare module '*.css';
declare module '*.scss';

// Basic globals
declare var console: any;
declare var window: any;
declare var document: any;
