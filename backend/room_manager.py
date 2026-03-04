from fastapi import WebSocket
from typing import Dict, List
import random


class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, Dict] = {}
        self.words: List[str] = self.load_words()
    
    def load_words(self) -> List[str]:
        """Load words from words.txt file"""
        try:
            with open('words.txt', 'r') as f:
                words = [line.strip() for line in f if line.strip()]
            print(f"📚 Loaded {len(words)} words")
            return words
        except FileNotFoundError:
            print("⚠️  words.txt not found, using default words")
            return ["apple", "banana", "car", "house", "tree", "phone", "computer", "pizza"]
    
    def get_random_words(self, count: int = 3) -> List[str]:
        """Get random words for word selection"""
        return random.sample(self.words, min(count, len(self.words)))
    
    async def join_room(self, room_id: str, websocket: WebSocket, username: str):
        """Add a player to a room"""
        # Create room if it doesn't exist
        if room_id not in self.rooms:
            self.rooms[room_id] = {
                "players": {},
                "drawer": None,
                "current_word": None,
                "turn": 0,  # Track individual turns (increments each draw)
                "settings": {},
                "game_started": False,
                "player_order": [],  # Track turn order
                "admin": username,  # First player is admin
                "correct_guessers": []  # Track who guessed correctly this round
            }
        
        # Check if player name already exists in this room
        existing_names = [p["name"] for p in self.rooms[room_id]["players"].values()]
        if username in existing_names:
            # Remove old connection for this username
            old_ws = None
            for ws, player in self.rooms[room_id]["players"].items():
                if player["name"] == username:
                    old_ws = ws
                    break
            if old_ws:
                self.rooms[room_id]["players"].pop(old_ws, None)
        
        # Add player to room
        self.rooms[room_id]["players"][websocket] = {
            "name": username,
            "score": 0,
            "ready": False
        }
        
        # Add to player order if not already there
        if username not in self.rooms[room_id]["player_order"]:
            self.rooms[room_id]["player_order"].append(username)
            print(f"   Added to player_order at position {len(self.rooms[room_id]['player_order']) - 1}")
        
        print(f"✅ {username} joined room {room_id}. Total players: {len(self.rooms[room_id]['players'])}")
        print(f"   WebSocket ID: {id(websocket)}")
        print(f"   Current player_order: {self.rooms[room_id]['player_order']}")
        print(f"   First player (will draw first): {self.rooms[room_id]['player_order'][0] if self.rooms[room_id]['player_order'] else 'None'}")
    
    async def kick_player(self, room_id: str, username: str, admin_name: str) -> bool:
        """Kick a player from the room (admin only)"""
        if room_id not in self.rooms:
            return False
        
        # Check if requester is admin
        if self.rooms[room_id].get("admin") != admin_name:
            return False
        
        # Find and remove the player
        for ws, player in list(self.rooms[room_id]["players"].items()):
            if player["name"] == username:
                self.rooms[room_id]["players"].pop(ws, None)
                # Remove from player order
                if username in self.rooms[room_id]["player_order"]:
                    self.rooms[room_id]["player_order"].remove(username)
                print(f"🚫 {admin_name} kicked {username} from room {room_id}")
                return True
        return False
    
    def leave_room(self, room_id: str, websocket: WebSocket):
        """Remove a player from a room"""
        if room_id in self.rooms:
            player_name = self.rooms[room_id]["players"].get(websocket, {}).get("name", "Unknown")
            self.rooms[room_id]["players"].pop(websocket, None)
            
            # Remove from player order
            if player_name in self.rooms[room_id]["player_order"]:
                self.rooms[room_id]["player_order"].remove(player_name)
            
            # If admin leaves, assign new admin
            if self.rooms[room_id].get("admin") == player_name and len(self.rooms[room_id]["players"]) > 0:
                # Make first remaining player the admin
                first_player = next(iter(self.rooms[room_id]["players"].values()))
                self.rooms[room_id]["admin"] = first_player["name"]
                print(f"👑 {first_player['name']} is now admin of room {room_id}")
            
            # Delete room if empty
            if len(self.rooms[room_id]["players"]) == 0:
                del self.rooms[room_id]
                print(f"🗑️  Room {room_id} deleted (empty)")
            else:
                print(f"👋 {player_name} left room {room_id}. Remaining: {len(self.rooms[room_id]['players'])}")
    
    def get_players(self, room_id: str) -> List[str]:
        """Get list of player names in a room"""
        if room_id not in self.rooms:
            return []
        return [
            player["name"]
            for player in self.rooms[room_id]["players"].values()
        ]
    
    def get_players_with_status(self, room_id: str) -> List[Dict]:
        """Get list of players with their ready status"""
        if room_id not in self.rooms:
            return []
        
        admin = self.rooms[room_id].get("admin", "")
        return [
            {
                "name": player["name"],
                "ready": player.get("ready", False),
                "score": player.get("score", 0),
                "is_admin": player["name"] == admin
            }
            for player in self.rooms[room_id]["players"].values()
        ]
    
    def is_admin(self, room_id: str, username: str) -> bool:
        """Check if user is admin of the room"""
        if room_id not in self.rooms:
            return False
        return self.rooms[room_id].get("admin") == username
    
    def set_player_ready(self, room_id: str, websocket: WebSocket, ready: bool):
        """Set ready state for a player"""
        if room_id in self.rooms and websocket in self.rooms[room_id]["players"]:
            self.rooms[room_id]["players"][websocket]["ready"] = ready
            player_name = self.rooms[room_id]["players"][websocket]["name"]
            print(f"{'✓' if ready else '✗'} {player_name} is {'ready' if ready else 'not ready'} in room {room_id}")
    
    async def broadcast(self, room_id: str, message: dict, exclude_sender: WebSocket = None):
        """Broadcast message to all players in a room (optionally excluding sender)"""
        if room_id not in self.rooms:
            return
        
        disconnected = []
        for ws in self.rooms[room_id]["players"]:
            if ws == exclude_sender:
                continue
            try:
                await ws.send_json(message)
            except Exception as e:
                print(f"❌ Failed to send to client: {e}")
                disconnected.append(ws)
        
        # Clean up disconnected clients
        for ws in disconnected:
            self.leave_room(room_id, ws)
    
    def room_exists(self, room_id: str) -> bool:
        """Check if a room exists"""
        return room_id in self.rooms
    
    def get_room_info(self, room_id: str) -> Dict:
        """Get full room information"""
        return self.rooms.get(room_id, {})
    
    def are_all_players_ready(self, room_id: str) -> bool:
        """Check if all players in the room are ready"""
        if room_id not in self.rooms:
            return False
        
    
    def start_new_round(self, room_id: str) -> Dict:
        """Start a new turn and select next drawer"""
        if room_id not in self.rooms:
            return {}
        
        room = self.rooms[room_id]
        room["turn"] = room.get("turn", 0) + 1
        
        # Get next drawer from player order
        player_order = room["player_order"]
        if not player_order:
            print(f"⚠️  No players in player_order for room {room_id}")
            return {}
        
        current_turn = room["turn"]
        player_count = len(player_order)
        
        # Calculate current round (1-3) based on how many complete cycles
        current_round = ((current_turn - 1) // player_count) + 1
        
        # Calculate drawer index
        drawer_index = (current_turn - 1) % player_count
        drawer_name = player_order[drawer_index]
        
        room["drawer"] = drawer_name
        room["current_word"] = None  # Word not chosen yet
        room["correct_guessers"] = []  # Reset correct guessers for new turn
        room["turn_ended"] = False  # Reset turn-ended flag
        room["game_started"] = True
        
        print(f"🎯 Round {current_round}, Turn {current_turn}/{player_count * 3} in room {room_id}. Drawer: {drawer_name}")
        print(f"   Player order: {player_order}")
        print(f"   Drawer index: {drawer_index}")
        print(f"   Connected players: {[p['name'] for p in room['players'].values()]}")
        
        return {
            "round": current_round,
            "turn": current_turn,
            "drawer": drawer_name,
            "total_rounds": 3  # 3 rounds total
        }
    
    def set_word(self, room_id: str, word: str):
        """Set the current word for the round"""
        if room_id in self.rooms:
            self.rooms[room_id]["current_word"] = word
            print(f"📝 Word set in room {room_id}: {word}")
    
    def add_correct_guesser(self, room_id: str, username: str) -> bool:
        """Add a player to the correct guessers list"""
        if room_id not in self.rooms:
            return False
        
        correct_guessers = self.rooms[room_id].get("correct_guessers", [])
        if username not in correct_guessers:
            correct_guessers.append(username)
            self.rooms[room_id]["correct_guessers"] = correct_guessers
            print(f"✅ {username} guessed correctly! Total correct: {len(correct_guessers)}")
            return True
        return False
    
    def check_all_guessed(self, room_id: str) -> bool:
        """Check if all non-drawer players have guessed correctly"""
        if room_id not in self.rooms:
            return False
        
        room = self.rooms[room_id]
        drawer = room.get("drawer")
        correct_guessers = room.get("correct_guessers", [])
        
        # Get all non-drawer player names
        all_players = [p["name"] for p in room["players"].values()]
        non_drawer_players = [p for p in all_players if p != drawer]
        
        print(f"🎯 Checking if all guessed: {len(correct_guessers)}/{len(non_drawer_players)}")
        print(f"   Non-drawer players: {non_drawer_players}")
        print(f"   Correct guessers: {correct_guessers}")
        
        # All non-drawer players must have guessed correctly
        return len(non_drawer_players) > 0 and len(correct_guessers) >= len(non_drawer_players)
    
    def is_game_complete(self, room_id: str) -> bool:
        """Check if all rounds have been completed"""
        if room_id not in self.rooms:
            return False
        
        room = self.rooms[room_id]
        current_turn = room.get("turn", 0)
        player_order = room.get("player_order", [])
        total_turns = len(player_order) * 3  # 3 rounds * number of players
        
        return current_turn >= total_turns
    
    def get_final_scores(self, room_id: str) -> list:
        """Get final scores sorted by score"""
        if room_id not in self.rooms:
            return []
        
        room = self.rooms[room_id]
        players = [
            {
                "name": player["name"],
                "score": player.get("score", 0)
            }
            for player in room["players"].values()
        ]
        
        # Sort by score descending
        return sorted(players, key=lambda x: x["score"], reverse=True)
        players = self.rooms[room_id]["players"]
        if len(players) < 2:  # Need at least 2 players
            return False
        
        # Check if all players are ready
        return all(player.get("ready", False) for player in players.values())
                    
                    