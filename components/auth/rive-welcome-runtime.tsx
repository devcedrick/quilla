"use client";

import {
  Alignment,
  DrawOptimizationOptions,
  Fit,
  Layout,
  RuntimeLoader,
  useRive,
} from "@rive-app/react-canvas";
import { useEffect, useRef, useState } from "react";
import contract from "@/lib/brand/kuwi-rive.json";

// Set both locations before instantiating the runtime: no CDN fallback requests.
RuntimeLoader.setWasmUrl(contract.wasm);
RuntimeLoader.setWasmFallbackUrl(contract.wasmFallback);
const layout = new Layout({ fit: Fit.Contain, alignment: Alignment.Center });

export function RiveWelcomeRuntime({
  onReady,
  onFailure,
}: {
  onReady: () => void;
  onFailure: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { rive, RiveComponent } = useRive(
    {
      src: contract.src,
      artboard: contract.artboard,
      stateMachine: contract.stateMachine,
      layout,
      // Start only once the host is visible; Rive owns all character keyframes.
      autoplay: false,
      // Mesh vertex changes are not consistently reflected by didChange() in
      // Canvas 2.45.1. Draw each playing frame rather than leaving a frozen pose.
      drawingOptions: DrawOptimizationOptions.AlwaysDraw,
      shouldDisableRiveListeners: true,
      onLoadError: onFailure,
    },
    { useDevicePixelRatio: true, shouldResizeCanvasToContainer: true },
  );

  useEffect(() => {
    if (!rive) return;
    let frame = 0;
    try {
      if (!rive.stateMachineNames.includes(contract.stateMachine)) {
        onFailure();
        return;
      }
      rive.resizeDrawingSurfaceToCanvas();
      rive.drawFrame();
      frame = requestAnimationFrame(onReady);
    } catch {
      onFailure();
    }
    return () => cancelAnimationFrame(frame);
  }, [rive, onReady, onFailure]);

  useEffect(() => {
    let intersecting = false;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      update();
    });
    if (host.current) observer.observe(host.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (!rive) return;
    try {
      if (visible) rive.play(contract.stateMachine);
      else rive.pause(contract.stateMachine);
    } catch {
      onFailure();
    }
    // useRive owns teardown. Calling pause in our cleanup would touch an
    // already-deleted WASM instance when its earlier cleanup runs on unmount.
  }, [rive, visible, onFailure]);

  return (
    <div
      ref={host}
      className="h-full w-full"
      data-testid="kuwi-playback"
      data-playing={visible}
    >
      <style href="kuwi-rive-canvas-sizing" precedence="default">{`
        .kuwi-rive-surface canvas {
          width: 100% !important;
          height: 100% !important;
          display: block;
        }
      `}</style>
      <RiveComponent
        aria-hidden="true"
        tabIndex={-1}
        className="kuwi-rive-surface h-full w-full"
        data-testid="kuwi-rive-canvas"
      />
    </div>
  );
}
