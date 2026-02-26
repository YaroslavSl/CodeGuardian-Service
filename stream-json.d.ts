declare module 'stream-json' {
  // Minimal typings for the parser we use
  import { Transform } from 'stream';

  export function parser(options?: unknown): Transform;
}

declare module 'stream-json/streamers/StreamValues' {
  import { Transform } from 'stream';

  export function streamValues(options?: unknown): Transform;
}

declare module 'stream-json/filters/Pick' {
  import { Transform } from 'stream';

  export function pick(options?: {
    filter?: string | RegExp | ((stack: unknown[], chunk?: unknown) => boolean);
    pathSeparator?: string;
  }): Transform;
}

