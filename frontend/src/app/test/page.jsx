"use client";

import { useEffect, useRef, useState } from "react";

export default function CanvasPage() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const colorRef = useRef("black"); // 👈 keeps latest color safely

  const [color, setColor] = useState("black");

  // Keep ref updated when color changes
  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    socketRef.current = new WebSocket("ws://localhost:8000/ws/room1");
    const socket = socketRef.current;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "start") {
        ctx.strokeStyle = data.color;
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      }

      if (data.type === "draw") {
        ctx.strokeStyle = data.color;
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
      }

      if (data.type === "stop") {
        ctx.beginPath();
      }

      if (data.type === "clear") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        y,
        color: colorRef.current
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
        y,
        color: colorRef.current
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
      <div className="flex flex-col gap-4 mb-4">
        <button onClick={() => setColor("red")} className="bg-red-500 px-4 py-2 text-white">
          Red
        </button>
        <button onClick={() => setColor("blue")} className="bg-blue-500 px-4 py-2 text-white">
          Blue
        </button>
        <button onClick={() => setColor("green")} className="bg-green-500 px-4 py-2 text-white">
          Green
        </button>
        <button
          onClick={() =>
            socketRef.current?.send(JSON.stringify({ type: "clear" }))
          }
          className="bg-gray-700 text-white px-4 py-2"
        >
          Clear
     </button>
                 
     <button
       onClick={() => setColor("white")}
       className="bg-gray-700 text-white px-4 py-2"
     >
       Eraser
     </button>                   
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="border border-black bg-white"
      />
    </div>
  );
}