import { useEffect, useRef, useState } from 'react';
import { Modal } from './kit';

/**
 * Reads a barcode or QR code with the camera. The decoder is a JavaScript library (loaded only
 * when the dialog opens) because Safari on iPhone has no native barcode API.
 */
export const ScannerDialog = ({ title, onResult, onClose }: { title: string; onResult: (text: string) => void; onClose: () => void }) => {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const latest = useRef(onResult);
  latest.current = onResult;

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | undefined;
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const found = await new BrowserMultiFormatReader().decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          video.current!,
          (result) => {
            if (!result || stopped) return;
            stopped = true;
            controls?.stop();
            latest.current(result.getText());
          },
        );
        controls = found;
        if (stopped) found.stop();
      } catch (error) {
        const denied = error instanceof DOMException && error.name === 'NotAllowedError';
        setProblem(denied ? 'Camera access was denied. Allow it in your browser settings.' : "The scanner isn't available on this device.");
      }
    })();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  return (
    <Modal title={title} onClose={onClose}>
      {problem ? <p className="muted">{problem}</p> : <video ref={video} className="scanner" playsInline muted />}
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
};
