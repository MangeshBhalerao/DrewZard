'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

interface DrawingCanvasProps {
  roomCode: string;
  username: string;
  color: string;
  brushSize: number;
  isDrawing: boolean;
  onDrawingChange: (drawing: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
  isDrawer?: boolean;  // Only drawer can draw
  socket?: WebSocket | null;  // Use shared WebSocket from parent
  fillMode?: boolean;  // Fill bucket mode
  onFillUsed?: () => void; // Called after each fill so parent can deactivate
}

export interface DrawingCanvasRef {
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ roomCode, username, color, brushSize, isDrawing, onDrawingChange, className, style, isDrawer = true, socket: externalSocket, fillMode = false, onFillUsed }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const isDrawingRef = useRef(false);
    const hasConnectedRef = useRef(false); // Prevent multiple connections
    const isDrawerRef = useRef(isDrawer);
    isDrawerRef.current = isDrawer; // always keep in sync with prop
    const fillModeRef = useRef(fillMode);
    fillModeRef.current = fillMode; // always keep in sync with prop
    const colorRef = useRef(color);
    colorRef.current = color; // always keep in sync with prop
    
    // Undo/Redo history
    const historyRef = useRef<ImageData[]>([]);
    const historyStepRef = useRef(0);
    // Track last received draw position for segment-by-segment rendering
    const lastReceivedPosRef = useRef<{ x: number; y: number } | null>(null);
    
    // Save canvas state to history
    const saveToHistory = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Remove any history after current step (when drawing after undo)
      historyRef.current = historyRef.current.slice(0, historyStepRef.current + 1);
      
      // Add new state to history
      historyRef.current.push(imageData);
      historyStepRef.current = historyRef.current.length - 1;
      
      // Limit history to 50 states to prevent memory issues
      if (historyRef.current.length > 50) {
        historyRef.current.shift();
        historyStepRef.current--;
      }
    };
    
    // Restore canvas from history
    const restoreFromHistory = (step: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;
      
      const imageData = historyRef.current[step];
      if (imageData) {
        ctx.putImageData(imageData, 0, 0);
      }
    };

    // Flood fill algorithm
    const floodFill = (startNx: number, startNy: number, fillColor: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Convert normalized (0-1) coords to physical canvas pixels (accounts for DPR)
      const physX = Math.round(startNx * canvas.width);
      const physY = Math.round(startNy * canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const idx = (physY * canvas.width + physX) * 4;
      const targetR = data[idx], targetG = data[idx + 1], targetB = data[idx + 2], targetA = data[idx + 3];

      // Parse fill color via a 1x1 temp canvas
      const tmp = document.createElement('canvas');
      tmp.width = tmp.height = 1;
      const tmpCtx = tmp.getContext('2d')!;
      tmpCtx.fillStyle = fillColor;
      tmpCtx.fillRect(0, 0, 1, 1);
      const fp = tmpCtx.getImageData(0, 0, 1, 1).data;
      const fillR = fp[0], fillG = fp[1], fillB = fp[2];

      // Already same color — nothing to do
      if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === 255) return;

      const tolerance = 15; // handles anti-aliased edges
      const w = canvas.width, h = canvas.height;
      const visited = new Uint8Array(w * h);
      const stack: number[] = [physY * w + physX];

      while (stack.length > 0) {
        const pos = stack.pop()!;
        const x = pos % w;
        const y = Math.floor(pos / w);
        if (x < 0 || x >= w || y < 0 || y >= h || visited[pos]) continue;
        const i = pos * 4;
        if (
          Math.abs(data[i]     - targetR) > tolerance ||
          Math.abs(data[i + 1] - targetG) > tolerance ||
          Math.abs(data[i + 2] - targetB) > tolerance ||
          Math.abs(data[i + 3] - targetA) > tolerance
        ) continue;
        visited[pos] = 1;
        data[i] = fillR; data[i + 1] = fillG; data[i + 2] = fillB; data[i + 3] = 255;
        if (x + 1 < w)  stack.push(y * w + x + 1);
        if (x - 1 >= 0) stack.push(y * w + x - 1);
        if (y + 1 < h)  stack.push((y + 1) * w + x);
        if (y - 1 >= 0) stack.push((y - 1) * w + x);
      }

      ctx.putImageData(imageData, 0, 0);
      saveToHistory();
    };

    // Use external socket if provided, otherwise create own
    useEffect(() => {
      if (externalSocket) {
        console.log('✅ Drawing Canvas using shared WebSocket');
        socketRef.current = externalSocket;
        return;
      } else {
        console.error('⚠️  No external socket provided to DrawingCanvas!');
      }
    }, [externalSocket]);

    useImperativeHandle(ref, () => ({
      clearCanvas: () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Save to history
        saveToHistory();

        // Send clear message to all connected clients
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'clear' }));
        }
      },
      undo: () => {
        if (historyStepRef.current > 0) {
          historyStepRef.current--;
          restoreFromHistory(historyStepRef.current);
          
          // Broadcast undo to all clients
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ 
              type: 'undo',
              historyStep: historyStepRef.current
            }));
          }
        }
      },
      redo: () => {
        if (historyStepRef.current < historyRef.current.length - 1) {
          historyStepRef.current++;
          restoreFromHistory(historyStepRef.current);
          
          // Broadcast redo to all clients
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ 
              type: 'redo',
              historyStep: historyStepRef.current
            }));
          }
        }
      },
    }));

    // WebSocket connection - DO NOT CREATE IF NO EXTERNAL SOCKET PROVIDED
    useEffect(() => {
      // MUST use external socket - never create our own
      if (!externalSocket) {
        console.error('❌ DrawingCanvas MUST receive external socket - will not work without it!');
        return;
      }

      console.log('✅ DrawingCanvas using shared WebSocket from parent (no duplicate connection)');
      socketRef.current = externalSocket;

    }, [externalSocket]); // Depend on externalSocket

    // Listen to external socket messages for drawing events
    useEffect(() => {
      if (!externalSocket) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);

        // If we are the drawer, skip draw echo messages (we draw locally already)
        if (isDrawerRef.current && ['start', 'draw', 'stop'].includes(data.type)) return;
        if (data.type === 'start') {
          const rect = canvas.getBoundingClientRect();
          const x = data.nx !== undefined ? data.nx * rect.width : data.x;
          const y = data.ny !== undefined ? data.ny * rect.height : data.y;
          ctx.strokeStyle = data.color;
          ctx.lineWidth = data.brushSize || 5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          lastReceivedPosRef.current = { x, y };
          // Draw dot immediately so single taps are visible
          ctx.fillStyle = data.color;
          ctx.beginPath();
          ctx.arc(x, y, (data.brushSize || 5) / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        if (data.type === 'draw') {
          const rect = canvas.getBoundingClientRect();
          const x = data.nx !== undefined ? data.nx * rect.width : data.x;
          const y = data.ny !== undefined ? data.ny * rect.height : data.y;
          const prev = lastReceivedPosRef.current;
          if (prev) {
            ctx.strokeStyle = data.color;
            ctx.lineWidth = data.brushSize || 5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
          lastReceivedPosRef.current = { x, y };
        }

        if (data.type === 'stop') {
          lastReceivedPosRef.current = null;
          // Save to history when receiving stop from other users
          saveToHistory();
        }

        if (data.type === 'fill') {
          // Only non-drawers receive the fill broadcast (drawer already applied it locally)
          if (!isDrawerRef.current) {
            floodFill(data.nx ?? 0, data.ny ?? 0, data.color);
          }
        }

        if (data.type === 'clear') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          // Save to history after clear
          saveToHistory();
        }
        
        if (data.type === 'undo' && data.historyStep !== undefined) {
          historyStepRef.current = data.historyStep;
          restoreFromHistory(data.historyStep);
        }
        
        if (data.type === 'redo' && data.historyStep !== undefined) {
          historyStepRef.current = data.historyStep;
          restoreFromHistory(data.historyStep);
        }
      };

      externalSocket.addEventListener('message', handleMessage);

      return () => {
        externalSocket.removeEventListener('message', handleMessage);
      };
    }, [externalSocket]);

    // Canvas setup
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // Save current canvas content (in raw pixels, ignoring dpr transform)
        const dpr = window.devicePixelRatio || 1;
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx?.drawImage(canvas, 0, 0);

        const displayWidth = rect.width;
        const displayHeight = rect.height;

        // Set backing store size for high-DPI
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;

        // Reset transform then scale once (avoids accumulation on repeated resize)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        // Restore previous drawing
        if (tempCanvas.width > 0 && tempCanvas.height > 0) {
          ctx.drawImage(
            tempCanvas,
            0, 0, tempCanvas.width, tempCanvas.height,
            0, 0, displayWidth, displayHeight
          );
        }

        // Initialize undo history
        if (historyRef.current.length === 0) {
          saveToHistory();
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const getCoordinates = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
    ): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ('touches' in e) {
        const touch = e.touches[0];
        if (!touch) return null;
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      // Return normalized 0-1 coordinates (device-independent)
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      };
    };

    // Convert normalized (0-1) coords to CSS display pixel coords
    const toDisplayCoords = (nx: number, ny: number): { x: number; y: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: nx * rect.width, y: ny * rect.height };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawer) return;
      
      if ('touches' in e) {
        e.preventDefault();
      }

      const norm = getCoordinates(e);
      if (!norm) return;

      // ── Fill mode: flood-fill on tap then return ──
      if (fillModeRef.current) {
        floodFill(norm.x, norm.y, colorRef.current);
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'fill',
            nx: norm.x,
            ny: norm.y,
            color: colorRef.current,
          }));
        }
        onFillUsed?.(); // auto-deactivate fill mode after one use
        return;
      }

      const { x, y } = toDisplayCoords(norm.x, norm.y);

      isDrawingRef.current = true;
      onDrawingChange(true);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Store start position for first segment
      lastReceivedPosRef.current = { x, y };

      // Draw a dot immediately so single taps leave a mark
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Send normalized coords to server
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'start',
          nx: norm.x,
          ny: norm.y,
          color: color,
          brushSize: brushSize,
        }));
      }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawer) return;
      if (!isDrawingRef.current) return;
      if (fillModeRef.current) return; // no drag-drawing in fill mode

      if ('touches' in e) {
        e.preventDefault();
      }

      const norm = getCoordinates(e);
      if (!norm) return;

      const { x, y } = toDisplayCoords(norm.x, norm.y);
      const prev = lastReceivedPosRef.current;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      if (prev) {
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      lastReceivedPosRef.current = { x, y };

      // Send normalized coords to server
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'draw',
          nx: norm.x,
          ny: norm.y,
          color: color,
          brushSize: brushSize,
        }));
      }
    };

    const stopDrawing = () => {
      if (!isDrawer) return;
      if (!isDrawingRef.current) return;

      isDrawingRef.current = false;
      onDrawingChange(false);
      lastReceivedPosRef.current = null;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.beginPath();
      }
      
      // Save to history after completing a stroke
      saveToHistory();

      // Send to server
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'stop',
        }));
      }
    };

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          ...style,
          touchAction: 'none',
          cursor: isDrawer ? (fillMode ? 'cell' : 'crosshair') : 'not-allowed',
          opacity: isDrawer ? 1 : 0.6,
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';
