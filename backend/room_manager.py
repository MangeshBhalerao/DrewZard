from fastapi import FastAPI , WebSocket
from typing import Dict,List

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}