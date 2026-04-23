import { useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { useAppStore } from '../store/useAppStore';

export function useModelsWarmup() {
  const { modelsLoaded, setModelsLoaded } = useAppStore();
  const initStarted = useRef(false);

  useEffect(() => {
    console.log("[Warmup] Effect running. modelsLoaded:", modelsLoaded, "initStarted:", initStarted.current);
    if (initStarted.current || modelsLoaded) return;
    initStarted.current = true;

    async function loadModels() {
      try {
        console.log("[Warmup] Starting loadModels...");
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        
        console.log("[Warmup] Models fetched. Pre-scanning sample face...");
        const img = new Image();
        img.src = '/sample-face.jpg';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        
        if (img.width > 0) {
           console.log("[Warmup] Running dummy detection on image...");
           await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        }

        console.log("[Warmup] Success! setModelsLoaded(true)");
        setModelsLoaded(true);
      } catch (e) {
        console.error("[Warmup] Error loading models", e);
        initStarted.current = false; // Allow retry
      }
    }

    loadModels();
  }, [modelsLoaded, setModelsLoaded]);
}
