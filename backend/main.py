from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from room_manager import RoomManager
import asyncio

app = FastAPI()

# CORS middleware for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = RoomManager()


@app.get("/")
async def root():
    return {"message": "DrewZard WebSocket Server Running! 🎨"}


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    current_username = None
    
    print(f"🔌 New WebSocket connection to room: {room_id}")

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            # Player joining the room
            if message_type == "join":
                current_username = data.get("username", "Anonymous")
                await manager.join_room(room_id, websocket, current_username)
                
                # Send updated player list with ready status to everyone
                players = manager.get_players_with_status(room_id)
                await manager.broadcast(room_id, {
                    "type": "players_update",
                    "players": players
                })
                
                # Send welcome message to the room
                await manager.broadcast(room_id, {
                    "type": "chat",
                    "username": "System",
                    "message": f"{current_username} joined the room!",
                    "isSystem": True
                })

            # Player ready state change
            elif message_type == "ready":
                ready_state = data.get("ready", False)
                manager.set_player_ready(room_id, websocket, ready_state)
                
                # Broadcast updated player list
                players = manager.get_players_with_status(room_id)
                await manager.broadcast(room_id, {
                    "type": "players_update",
                    "players": players
                })

            # Admin starts the game
            elif message_type == "start_game":
                username = data.get("username", "")
                
                # Check if user is admin
                if not manager.is_admin(room_id, username):
                    await websocket.send_json({
                        "type": "error",
                        "message": "Only the room admin can start the game"
                    })
                    continue
                
                # Check player count
                player_count = len(manager.rooms[room_id].get("players", {}))
                print(f"🎮 Admin {username} starting game in room {room_id}...")
                print(f"   Player count in room: {player_count}")
                print(f"   Players: {[p['name'] for p in manager.rooms[room_id]['players'].values()]}")
                
                if player_count < 2:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Need at least 2 players to start the game"
                    })
                    continue
                
                # Send countdown notification
                await manager.broadcast(room_id, {
                    "type": "game_starting",
                    "countdown": 3
                })
                
                # Wait 3 seconds then start game
                await asyncio.sleep(3)
                
                # Send game start signal
                await manager.broadcast(room_id, {
                    "type": "game_start",
                    "room_code": room_id
                })
                
                # Small delay to ensure game page loads
                await asyncio.sleep(1)
                
                # Start first round
                print(f"🎲 Starting first round in room {room_id}...")
                round_info = manager.start_new_round(room_id)
                if round_info:
                    # Get random words for drawer to choose
                    word_choices = manager.get_random_words(3)
                    print(f"🎲 Generated word choices: {word_choices}")
                    
                    # Send round info to all players
                    players = manager.get_players_with_status(room_id)
                    print(f"📤 Broadcasting round_start to all players...")
                    print(f"   Round: {round_info['round']}, Drawer: {round_info['drawer']}")
                    await manager.broadcast(room_id, {
                        "type": "round_start",
                        "round": round_info["round"],
                        "drawer": round_info["drawer"],
                        "total_rounds": round_info["total_rounds"],
                        "players": players
                    })
                    print(f"✅ round_start broadcast complete")
                    
                    # Small delay to ensure drawer state updates on frontend
                    await asyncio.sleep(0.5)
                    
                    # Send word choices only to drawer
                    drawer_found = False
                    drawer_ws = None
                    print(f"🔍 Looking for drawer '{round_info['drawer']}' in room players...")
                    print(f"   Current players in room: {[(p['name'], id(ws)) for ws, p in manager.rooms[room_id]['players'].items()]}")
                    
                    for ws, player in manager.rooms[room_id]["players"].items():
                        print(f"   Checking player: {player['name']} (WS ID: {id(ws)})")
                        if player["name"] == round_info["drawer"]:
                            drawer_ws = ws
                            drawer_found = True
                            print(f"✅✅✅ FOUND DRAWER: {player['name']} at WebSocket {id(ws)}")
                            break
                    
                    if drawer_found and drawer_ws:
                        try:
                            print(f"📤 Sending word_choices to drawer {round_info['drawer']}...")
                            await drawer_ws.send_json({
                                "type": "word_choices",
                                "words": word_choices,
                                "drawer": round_info["drawer"]
                            })
                            print(f"✅ word_choices sent successfully to {round_info['drawer']}!")
                        except Exception as e:
                            print(f"❌ Error sending word choices: {e}")
                    else:
                        print(f"❌❌❌ DRAWER NOT FOUND: {round_info['drawer']}")
                        print(f"   Available players: {[p['name'] for p in manager.rooms[room_id]['players'].values()]}")

            # Kick player (admin only)
            elif message_type == "kick_player":
                admin_username = data.get("admin_username", "")
                player_to_kick = data.get("player_name", "")
                
                # Kick the player
                success = await manager.kick_player(room_id, player_to_kick, admin_username)
                
                if success:
                    # Broadcast updated player list
                    players = manager.get_players_with_status(room_id)
                    await manager.broadcast(room_id, {
                        "type": "players_update",
                        "players": players
                    })
                    
                    # Send kick notification
                    await manager.broadcast(room_id, {
                        "type": "player_kicked",
                        "player_name": player_to_kick
                    })
                    
                    await manager.broadcast(room_id, {
                        "type": "chat",
                        "username": "System",
                        "message": f"{player_to_kick} was kicked from the room.",
                        "isSystem": True
                    })

            # Word selection by drawer
            elif message_type == "word_selected":
                word = data.get("word", "")
                manager.set_word(room_id, word)
                
                # Broadcast that word was chosen (hide the word from guessers)
                word_hint = "_" * len(word)
                await manager.broadcast(room_id, {
                    "type": "word_chosen",
                    "word_hint": word_hint,
                    "word_length": len(word)
                })

            # Drawing events - broadcast to everyone in the room
            elif message_type in ["start", "draw", "stop", "clear"]:
                await manager.broadcast(room_id, data)

            # Chat messages
            elif message_type == "chat":
                username = data.get("username", "Anonymous")
                message = data.get("message", "")
                
                await manager.broadcast(room_id, {
                    "type": "chat",
                    "username": username,
                    "message": message,
                    "isSystem": False
                })

            # Game start
            elif message_type == "game_start":
                await manager.broadcast(room_id, {
                    "type": "game_start",
                    "room_code": room_id
                })

            else:
                print(f"⚠️  Unknown message type: {message_type}")

    except WebSocketDisconnect:
        print(f"🔌 WebSocket disconnected from room: {room_id}")
        manager.leave_room(room_id, websocket)
        
        # Notify others that player left
        if current_username:
            players = manager.get_players_with_status(room_id)
            await manager.broadcast(room_id, {
                "type": "players_update",
                "players": players
            })
            await manager.broadcast(room_id, {
                "type": "chat",
                "username": "System",
                "message": f"{current_username} left the room.",
                "isSystem": True
            })
    
    except Exception as e:
        print(f"❌ Error in WebSocket: {e}")
        manager.leave_room(room_id, websocket)