# from fastapi import FastAPI , WebSocket
# import asyncio

# app = FastAPI()

# @app.websocket("/ws")
# async def websocket_endpoint(websocket: WebSocket):
#     await websocket.accept()
    
    
#     count = 0
      
#     while True:
#         # data = await websocket.receive_text()
#         # await websocket.send_text(f"Hello World{data}")
#         await asyncio.sleep(2)  # non-blocking wait
#         count += 1
#         await websocket.send_text(f"Server message {count}")
  
      
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio

app = FastAPI()

connections = []  # store all connected clients


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connections.append(websocket)

    try:
        while True:
            await asyncio.sleep(2)

            for connection in connections:
                await connection.send_text("Hello everyone")

    except WebSocketDisconnect:
        connections.remove(websocket)