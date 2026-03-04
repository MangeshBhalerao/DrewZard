from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from room_manager import RoomManager
import asyncio
import os
import time

app = FastAPI()

# Background task: delete rooms that have been empty for > 2 minutes
async def cleanup_empty_rooms():
    while True:
        await asyncio.sleep(30)  # Check every 30 seconds
        now = time.time()
        to_delete = [
            room_id for room_id, room in list(manager.rooms.items())
            if len(room.get("players", {})) == 0 and now - room.get("empty_since", now) > 120
        ]
        for room_id in to_delete:
            del manager.rooms[room_id]
            print(f"🗑️  Room {room_id} deleted after 2 minutes empty")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_empty_rooms())

# CORS — allow frontend origin (set FRONTEND_URL env var in production)
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
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

            # Players ready on game page - start first round
            elif message_type == "game_ready":
                username = data.get("username", "")
                
                # Check if round hasn't started yet
                room = manager.rooms.get(room_id, {})
                current_turn = room.get("turn", 0)
                total_players = len(room.get("player_order", []))
                connected_players = len(room.get("players", {}))
                
                # Start round only if: turn not started AND all players connected
                if current_turn == 0 and connected_players >= total_players and total_players >= 2:
                    round_info = manager.start_new_round(room_id)
                    if round_info:
                        # Get random words for drawer to choose
                        word_choices = manager.get_random_words(3)
                        
                        # Send round info to all players
                        players = manager.get_players_with_status(room_id)
                        await manager.broadcast(room_id, {
                            "type": "round_start",
                            "round": round_info["round"],
                            "drawer": round_info["drawer"],
                            "total_rounds": round_info["total_rounds"],
                            "players": players
                        })
                        
                        # Small delay to ensure drawer state updates on frontend
                        await asyncio.sleep(0.5)
                        
                        # Send word choices only to drawer
                        drawer_ws = None
                        for ws, player in manager.rooms[room_id]["players"].items():
                            if player["name"] == round_info["drawer"]:
                                drawer_ws = ws
                                break
                        
                        if drawer_ws:
                            await drawer_ws.send_json({
                                "type": "word_choices",
                                "words": word_choices,
                                "drawer": round_info["drawer"]
                            })

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

            # Drawing events - broadcast to everyone EXCEPT the sender (no echo)
            elif message_type in ["start", "draw", "stop", "clear", "undo", "redo"]:
                await manager.broadcast(room_id, data, exclude_sender=websocket)

            # Chat messages
            elif message_type == "chat":
                username = data.get("username", "Anonymous")
                message = data.get("message", "")
                
                # Check if the message is a correct guess
                room = manager.rooms.get(room_id, {})
                current_word = room.get("current_word", "").lower()
                drawer = room.get("drawer", "")
                is_correct = False
                
                # Only check guesses for non-drawer players
                if username != drawer and current_word and message.lower().strip() == current_word:
                    is_correct = True
                    manager.add_correct_guesser(room_id, username)
                    
                    # Update player score
                    for ws, player in room["players"].items():
                        if player["name"] == username:
                            player["score"] = player.get("score", 0) + 100
                            break
                    
                    print(f"✅ {username} guessed correctly: '{message}'")
                    
                    # If all players guessed — end this turn early (server-side)
                    if manager.check_all_guessed(room_id):
                        room = manager.rooms.get(room_id, {})
                        # Guard against double-processing
                        if not room.get("turn_ended", False):
                            room["turn_ended"] = True
                            correct_word = room.get("current_word", "")
                            print(f"🎉 All guessed! Ending turn early in room {room_id}")
                            
                            # Tell frontend: turn is over (stops their timer)
                            await manager.broadcast(room_id, {
                                "type": "turn_end",
                                "reason": "all_guessed",
                                "correct_word": correct_word
                            })
                            
                            await asyncio.sleep(3)
                            
                            if manager.is_game_complete(room_id):
                                final_scores = manager.get_final_scores(room_id)
                                await manager.broadcast(room_id, {
                                    "type": "game_complete",
                                    "final_scores": final_scores,
                                    "winner": final_scores[0]["name"] if final_scores else None
                                })
                            else:
                                round_info = manager.start_new_round(room_id)
                                if round_info:
                                    players = manager.get_players_with_status(room_id)
                                    await manager.broadcast(room_id, {
                                        "type": "round_start",
                                        "round": round_info["round"],
                                        "drawer": round_info["drawer"],
                                        "players": players
                                    })
                                    await asyncio.sleep(0.5)
                                    words = manager.get_random_words(3)
                                    drawer_name = round_info["drawer"]
                                    drawer_ws = None
                                    for ws, player in manager.rooms[room_id]["players"].items():
                                        if player["name"] == drawer_name:
                                            drawer_ws = ws
                                            break
                                    if drawer_ws:
                                        await drawer_ws.send_json({
                                            "type": "word_choices",
                                            "words": words,
                                            "drawer": drawer_name
                                        })
                
                # Broadcast chat message (hide correct guesses from chat)
                if not is_correct:
                    await manager.broadcast(room_id, {
                        "type": "chat",
                        "username": username,
                        "message": message,
                        "isSystem": False
                    })
                else:
                    # Broadcast correct guess notification
                    await manager.broadcast(room_id, {
                        "type": "correct_guess",
                        "username": username,
                        "message": message
                    })
            
            # Turn end triggered by frontend timer
            elif message_type == "round_end":
                room = manager.rooms.get(room_id, {})
                # Skip if turn already ended server-side (all_guessed)
                if room.get("turn_ended", False):
                    continue
                room["turn_ended"] = True
                reason = data.get("reason", "time_up")
                correct_word = room.get("current_word", "")
                
                print(f"🏁 Turn ended (timer) in room {room_id}. Reason: {reason}")
                
                # Broadcast turn end with correct word
                await manager.broadcast(room_id, {
                    "type": "turn_end",
                    "reason": reason,
                    "correct_word": correct_word
                })
                
                # Wait a bit before starting next round or ending game
                await asyncio.sleep(3)
                
                # Check if game is complete
                if manager.is_game_complete(room_id):
                    print(f"🎉 Game complete in room {room_id}!")
                    final_scores = manager.get_final_scores(room_id)
                    await manager.broadcast(room_id, {
                        "type": "game_complete",
                        "final_scores": final_scores,
                        "winner": final_scores[0]["name"] if final_scores else None
                    })
                else:
                    # Start next round
                    round_info = manager.start_new_round(room_id)
                    if round_info:
                        # Broadcast new round start
                        players = manager.get_players_with_status(room_id)
                        await manager.broadcast(room_id, {
                            "type": "round_start",
                            "round": round_info["round"],
                            "drawer": round_info["drawer"],
                            "players": players
                        })
                        
                        # Send word choices to the new drawer
                        await asyncio.sleep(0.5)
                        words = manager.get_random_words(3)
                        drawer_name = round_info["drawer"]
                        
                        # Find the drawer's websocket
                        drawer_ws = None
                        for ws, player in room["players"].items():
                            if player["name"] == drawer_name:
                                drawer_ws = ws
                                break
                        
                        if drawer_ws:
                            print(f"📤 Sending word_choices to new drawer: {drawer_name}")
                            await drawer_ws.send_json({
                                "type": "word_choices",
                                "words": words,
                                "drawer": drawer_name
                            })
                        else:
                            print(f"⚠️  Could not find WebSocket for drawer: {drawer_name}")

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