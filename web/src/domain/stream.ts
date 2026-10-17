import type { Stream } from './repositories';

/** Re-emits [f] of the latest value of every stream, once each has emitted. Like Flow.combine. */
export const combine = <Values extends readonly unknown[], R>(
  streams: { readonly [K in keyof Values]: Stream<Values[K]> },
  f: (...values: Values) => R,
): Stream<R> => ({
  subscribe(next, error) {
    const latest: unknown[] = new Array(streams.length);
    const ready = new Array<boolean>(streams.length).fill(false);
    const stops = streams.map((stream, i) =>
      stream.subscribe((value) => {
        latest[i] = value;
        ready[i] = true;
        if (ready.every(Boolean)) next(f(...(latest as unknown as Values)));
      }, error),
    );
    return () => stops.forEach((stop) => stop());
  },
});

export const mapStream = <T, R>(stream: Stream<T>, f: (value: T) => R): Stream<R> => ({
  subscribe: (next, error) => stream.subscribe((value) => next(f(value)), error),
});
