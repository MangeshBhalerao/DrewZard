"use client";

import { useEffect, useRef } from "react";

export default function CanvasPage() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
  
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
  
    const socket = new WebSocket("ws://localhost:8000/ws/room1");
  
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
  
      if (data.type === "start") {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      }
  
      if (data.type === "draw") {
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
      }
  
      if (data.type === "stop") {
        ctx.beginPath();
      }
    };
  
    let drawing = false;
  
    const startDrawing = (event) => {
      drawing = true;
  
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
  
      socket.send(JSON.stringify({
        type: "start",
        x,
        y
      }));
    };
  
    const draw = (event) => {
      if (!drawing) return;
  
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
  
      socket.send(JSON.stringify({
        type: "draw",
        x,
        y
      }));
    };
  
    const stopDrawing = () => {
      drawing = false;
  
      socket.send(JSON.stringify({
        type: "stop"
      }));
    };
  
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mousemove", draw);
  
    return () => {
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mousemove", draw);
      socket.close();
    };
  }, []);
    

  return (
    <div className="flex justify-center items-center h-screen">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="border border-black bg-white"
      />
    </div>
  );
}