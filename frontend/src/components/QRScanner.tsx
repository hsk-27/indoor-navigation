import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Spinner from './ui/Spinner';

interface QRScannerProps {
  onScanSuccess: (qrCode: string) => void;
  onScanError: (error: string) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onScanError }) => {
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const qrcodeRegionId = "qr-reader-container";
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanErrorRef = useRef(onScanError);
  onScanSuccessRef.current = onScanSuccess;
  onScanErrorRef.current = onScanError;

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(qrcodeRegionId);
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().then(() => {
            onScanSuccessRef.current(decodedText);
          }).catch(err => {
            console.error("Failed to stop scanner:", err);
            onScanSuccessRef.current(decodedText);
          });
        }
      },
      (_errorMessage) => {}
    ).then(() => {
      setIsInitializing(false);
    }).catch((err) => {
      console.error("Camera initialization failed:", err);
      setIsInitializing(false);
      setHasPermissionError(true);
      onScanErrorRef.current("Camera access denied or unavailable.");
    });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  if (hasPermissionError) {
    return (
      <div className="p-6 text-center text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-2xl">
        <svg className="w-10 h-10 mx-auto mb-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />
        </svg>
        <p className="font-semibold">Camera Access Required</p>
        <p className="text-sm mt-1 text-rose-400">Please enable camera permissions to scan QR codes.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-3xl shadow-2xl shadow-primary-900/50 border-4 border-surface-darker/50 bg-black aspect-[3/4]">
      {isInitializing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-dark">
          <Spinner size="lg" color="text-accent-DEFAULT" />
          <p className="mt-4 text-sm font-medium text-slate-400 animate-pulse">Initializing Camera...</p>
        </div>
      )}
      
      <div id={qrcodeRegionId} className="w-full h-full object-cover [&>video]:object-cover [&>video]:h-full" />
      
      {/* Modern Viewfinder Overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
        <div className="w-64 h-64 border-2 border-white/20 rounded-3xl relative overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
          {/* Corner highlights */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-accent-DEFAULT rounded-tl-xl"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-accent-DEFAULT rounded-tr-xl"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-accent-DEFAULT rounded-bl-xl"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-accent-DEFAULT rounded-br-xl"></div>
          {/* Animated scanning line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-accent-DEFAULT/80 shadow-[0_0_15px_rgba(6,182,212,0.8)] animate-slide-up" style={{ animationDuration: '2s', animationIterationCount: 'infinite' }}></div>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
