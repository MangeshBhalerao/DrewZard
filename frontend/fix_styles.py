import re
import glob
import os

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to replace '#ffffff' -> 'var(--card)' except for the Eraser logic
    # The eraser logic uses currentColor === '#ffffff' or setCurrentColor('#ffffff')
    # So we can replace backgroundColor: '#ffffff'
    content = content.replace("backgroundColor: '#ffffff'", "backgroundColor: 'var(--card)'")
    content = content.replace("backgroundColor: copiedLink ? '#bae1ba' : '#ffffff'", "backgroundColor: copiedLink ? '#bae1ba' : 'var(--card)'")
    content = content.replace("backgroundColor: index === 0 ? '#bae1ba' : '#ffffff'", "backgroundColor: index === 0 ? '#bae1ba' : 'var(--card)'")
    content = content.replace("backgroundColor: brushSize === size ? '#5eb3f6' : '#ffffff'", "backgroundColor: brushSize === size ? 'var(--primary)' : 'var(--card)'")
    
    # Text on main background
    content = content.replace("color: '#2a2a2a'", "color: 'var(--foreground)'")
    content = content.replace("color: '#6a6a6a'", "color: 'var(--muted-foreground)'")
    
#only legends know abt this :)

    # Borders
    content = content.replace("border: '4px solid #2a2a2a'", "border: '4px solid var(--foreground)'")
    content = content.replace("border: '6px solid #2a2a2a'", "border: '6px solid var(--foreground)'")
    content = content.replace("border: '3px solid #2a2a2a'", "border: '3px solid var(--foreground)'")
    content = content.replace("border: '2px solid #2a2a2a'", "border: '2px solid var(--border)'")
    content = content.replace("borderBottom: '2px dashed rgba(42, 42, 42, 0.2)'", "borderBottom: '2px dashed var(--border)'")
    
    # Shadows
    content = content.replace("boxShadow: '5px 5px 0px 0px rgba(42, 42, 42, 0.3)'", "boxShadow: '5px 5px 0px 0px var(--border)'")
    content = content.replace("boxShadow: '4px 4px 0px 0px rgba(42, 42, 42, 0.3)'", "boxShadow: '4px 4px 0px 0px var(--border)'")
    content = content.replace("boxShadow: '3px 3px 0 rgba(42,42,42,0.2)'", "boxShadow: '3px 3px 0 var(--border)'")
    content = content.replace("boxShadow: '10px 10px 0px 0px rgba(42, 42, 42, 0.5)'", "boxShadow: '10px 10px 0px 0px var(--border)'")
    content = content.replace("boxShadow: '2px 2px 0px 0px rgba(42, 42, 42, 0.3)'", "boxShadow: '2px 2px 0px 0px var(--border)'")
    
    # Some specific backgrounds
    content = content.replace("backgroundColor: msg.isSystem ? '#f0f0e0' : 'rgba(94, 179, 246, 0.1)'", "backgroundColor: msg.isSystem ? 'var(--muted)' : 'rgba(94, 179, 246, 0.1)'")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for filepath in [
    'e:/projects/DrewZard/frontend/app/lobby/[roomCode]/page.tsx',
    'e:/projects/DrewZard/frontend/app/game/[roomCode]/page.tsx',
    'e:/projects/DrewZard/frontend/components/DrawingCanvas.tsx'
]:
    if os.path.exists(filepath):
        replace_in_file(filepath)
