'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, AlertCircle } from 'lucide-react';

interface WebcamCaptureProps {
  onCapture: (base64Data: string) => void;
  onCancel: () => void;
}

export function WebcamCapture({ onCapture, onCancel }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setCameraError(
        'Could not access camera. Please allow camera permissions in your browser or upload a file.',
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      stopCamera();
    }
  };

  return (
    <div className="flex flex-col items-center bg-slate-900 text-white rounded-xl p-4 border border-slate-800">
      <div className="relative w-full max-w-sm aspect-[4/3] bg-black rounded-lg overflow-hidden flex items-center justify-center">
        {cameraError ? (
          <div className="p-4 text-center text-xs text-red-400 flex flex-col items-center space-y-2">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <p>{cameraError}</p>
          </div>
        ) : capturedImage ? (
          <img src={capturedImage} alt="Captured photograph" className="w-full h-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Controls */}
      <div className="mt-4 flex items-center space-x-3">
        {capturedImage ? (
          <>
            <button
              type="button"
              onClick={handleRetake}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retake Photo</span>
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow transition cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Use Photo</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleCapture}
              disabled={!!cameraError}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 shadow transition disabled:opacity-50 cursor-pointer"
            >
              <Camera className="h-4 w-4" />
              <span>Take Snapshot</span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onCancel();
              }}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
