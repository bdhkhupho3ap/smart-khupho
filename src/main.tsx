import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Dynamic API gateway proxy for external static hosting environments (like Vercel)
const originalFetch = window.fetch;
const customProxyFetch = function (input: any, init?: any) {
  let url = typeof input === "string" ? input : input instanceof URL ? input.toString() : "";
  if (typeof input === "object" && input !== null && 'url' in input) {
    url = (input as any).url;
  }

  // Cloud Run app instance in modern sandboxed environment
  const BACKEND_URL = "https://ais-pre-n554cra6cbkec4dtmhjpi3-407067520621.asia-southeast1.run.app";
  
  const isStaticExternalHost = 
    window.location.hostname.includes("vercel.app") || 
    window.location.hostname.includes("github.io") || 
    window.location.hostname.includes("netlify.app") ||
    (window.location.hostname === "localhost" && window.location.port !== "3000" && window.location.port !== "");

  if (url.startsWith("/api/") && isStaticExternalHost) {
    const absoluteUrl = `${BACKEND_URL}${url}`;
    console.log(`[Cloud Sync Proxy] Route /api -> ${absoluteUrl}`);
    
    if (typeof input === "string") {
      return originalFetch(absoluteUrl, init);
    }
    const newRequest = new Request(absoluteUrl, init || (input as RequestInit));
    return originalFetch(newRequest);
  }
  
  return originalFetch(input, init);
};

try {
  Object.defineProperty(window, 'fetch', {
    value: customProxyFetch,
    writable: true,
    configurable: true
  });
} catch (e: any) {
  console.warn("Direct window.fetch override failed. Attempting alternative methods:", e.message);
  try {
    // Try to override via prototype chain if instance override is blocked
    const winProto = Object.getPrototypeOf(window);
    if (winProto && winProto.fetch) {
      Object.defineProperty(winProto, 'fetch', {
        value: customProxyFetch,
        writable: true,
        configurable: true
      });
    } else {
      (window as any).fetch = customProxyFetch;
    }
  } catch (protoErr: any) {
    console.warn("All programmatic overrides of window.fetch were blocked by environment:", protoErr.message);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
