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

rooms = {}  # store all connected clients


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket , room_id: str):
     await websocket.accept()
    
     if room_id not in rooms:
         rooms[room_id] = []
    
     rooms[room_id].append(websocket)

     try:
          while True:
               data = await websocket.receive_json()

               for connection in rooms[room_id]:
                    await connection.send_json(data)

     except WebSocketDisconnect:
            rooms[room_id].remove(websocket)
    
            if not rooms[room_id]:
                del rooms[room_id]