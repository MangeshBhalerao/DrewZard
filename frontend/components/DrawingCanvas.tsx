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
}

export interface DrawingCanvasRef {
  clearCanvas: () => void;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ roomCode, username, color, brushSize, isDrawing, onDrawingChange, className, style, isDrawer = true, socket: externalSocket }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const isDrawingRef = useRef(false);
    const hasConnectedRef = useRef(false); // Prevent multiple connections

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

        // Send clear message to all connected clients
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'clear' }));
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

        // Only handle drawing-related messages
        if (data.type === 'start') {
          ctx.strokeStyle = data.color;
          ctx.lineWidth = data.brushSize || 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(data.x, data.y);
        }

        if (data.type === 'draw') {
          ctx.strokeStyle = data.color;
          ctx.lineWidth = data.brushSize || 5;
          ctx.lineCap = 'round';
          ctx.lineTo(data.x, data.y);
          ctx.stroke();
        }

        if (data.type === 'stop') {
          ctx.beginPath();
        }

        if (data.type === 'clear') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
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
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Save current canvas content
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx?.drawImage(canvas, 0, 0);

        // Resize canvas
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Restore content
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
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
      let x: number;
      let y: number;

      if ('touches' in e) {
        const touch = e.touches[0];
        if (!touch) return null;
        x = touch.clientX - rect.left;
        y = touch.clientY - rect.top;
      } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      }

      return { x, y };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawer) return;  // Only drawer can draw
      
      if ('touches' in e) {
        e.preventDefault();
      }

      const coords = getCoordinates(e);
      if (!coords) return;

      isDrawingRef.current = true;
      onDrawingChange(true);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);

      // Send to server
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'start',
          x: coords.x,
          y: coords.y,
          color: color,
          brushSize: brushSize,
        }));
      }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawer) return;  // Only drawer can draw
      if (!isDrawingRef.current) return;

      if ('touches' in e) {
        e.preventDefault();
      }

      const coords = getCoordinates(e);
      if (!coords) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      // Send to server
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'draw',
          x: coords.x,
          y: coords.y,
          color: color,
          brushSize: brushSize,
        }));
      }
    };

    const stopDrawing = () => {
      if (!isDrawer) return;  // Only drawer can draw
      if (!isDrawingRef.current) return;

      isDrawingRef.current = false;
      onDrawingChange(false);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.beginPath();
      }

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
          cursor: isDrawer ? 'crosshair' : 'not-allowed',
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
