import { createContext, useCallback, useContext, useEffect, useRef, useState, type DependencyList, type ReactNode } from 'react';

type Show = (message: string) => void;

const ToastContext = createContext<Show>(() => undefined);

/** A short message at the bottom of the screen, gone after a few seconds. */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback<Show>((text) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && <div className="toast" role="status">{message}</div>}
    </ToastContext.Provider>
  );
};

export const useToast = (): Show => useContext(ToastContext);

export type Async<T> = { readonly state: 'loading' } | { readonly state: 'ready'; readonly value: T } | { readonly state: 'failed'; readonly error: unknown };

/** Runs [load] when [deps] change; a late answer to an older request is ignored. */
export const useAsync = <T,>(load: () => Promise<T>, deps: DependencyList): Async<T> => {
  const [result, setResult] = useState<Async<T>>({ state: 'loading' });
  useEffect(() => {
    let current = true;
    setResult({ state: 'loading' });
    load().then(
      (value) => current && setResult({ state: 'ready', value }),
      (error: unknown) => current && setResult({ state: 'failed', error }),
    );
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return result;
};
