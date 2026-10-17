import { createContext, useContext, useEffect, useState, type DependencyList, type ReactNode } from 'react';
import type { Stream } from '../domain/repositories';
import type { Container } from './container';

const ContainerContext = createContext<Container | null>(null);

export const ContainerProvider = ({ container, children }: { container: Container; children: ReactNode }) => (
  <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>
);

export const useContainer = (): Container => {
  const container = useContext(ContainerContext);
  if (!container) throw new Error('useContainer needs a ContainerProvider above it');
  return container;
};

/**
 * The latest value of a stream, or undefined until it first emits. The stream is made again when
 * [deps] change. Re-renders only when the value changes, and stops listening on unmount.
 */
export const useStream = <T,>(make: (container: Container) => Stream<T>, deps: DependencyList = []): T | undefined => {
  const container = useContainer();
  const [value, setValue] = useState<{ current: T } | undefined>();
  const [failure, setFailure] = useState<unknown>();
  if (failure) throw failure; // surfaces to the nearest error boundary

  useEffect(() => {
    setValue(undefined);
    return make(container).subscribe((next) => setValue({ current: next }), setFailure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, ...deps]);

  return value?.current;
};
