#!/bin/bash
# One-time install of Agent HQ on a Mac (2.38.0). Paste this line into Terminal (Applications > Utilities > Terminal):
#   curl -fsSL https://raw.githubusercontent.com/Mismail933/agent-hq/main/mac-install.sh | bash
# It puts the program in ~/Agent-HQ, adds "Agent HQ" to the Desktop and opens it. From then on: double-click "Agent HQ".
# (Files fetched this way aren't blocked by the Mac's "unidentified developer" check; a zip from the browser would be.)
set -e
DEST="$HOME/Agent-HQ"
if [ ! -f "$DEST/launch.py" ]; then
  echo "Downloading Agent HQ..."
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/hq.zip" https://github.com/Mismail933/agent-hq/archive/refs/heads/main.zip
  unzip -q "$tmp/hq.zip" -d "$tmp"
  mkdir -p "$DEST"
  cp -R "$tmp"/agent-hq-main/. "$DEST"/
  rm -rf "$tmp"
fi
chmod +x "$DEST/START-HERE.command"
cat > "$HOME/Desktop/Agent HQ.command" <<EOF
#!/bin/bash
exec "$DEST/START-HERE.command"
EOF
chmod +x "$HOME/Desktop/Agent HQ.command"
echo "Installed in $DEST. Opening Agent HQ (a new window)..."
open "$DEST/START-HERE.command"
