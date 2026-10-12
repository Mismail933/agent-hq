#!/bin/bash
# Agent HQ on a Mac: double-click this file (on Windows it is START-HERE.bat). It stays the same; the real work is in launch.py,
# which updates itself. First time only it installs the free tools Agent HQ needs (Homebrew, Python 3.12, FFmpeg, Claude Code).
cd "$(dirname "$0")" || exit 1
printf '\033]0;Agent HQ\007'
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"

ask() { read -r -p "  $1 [Y/n] " a; [[ -z "$a" || "$a" =~ ^[Yy] ]]; }
stop() { echo; echo "  $1"; read -r -p "  Press Enter to close." _; exit 1; }

echo
echo "  Agent HQ"
echo "  --------"

if ! command -v brew >/dev/null 2>&1; then
  echo "  Homebrew (the Mac's standard installer for free tools) is needed for Python and FFmpeg."
  echo "  It asks for your Mac password once: the typing doesn't show, that's normal."
  ask "Install Homebrew now?" || stop "Agent HQ can't start without it. Run this file again when you're ready."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || stop "Homebrew didn't install. Send the error above to Claude."
  eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
fi

need=()
command -v python3.12 >/dev/null 2>&1 || need+=(python@3.12)
command -v ffmpeg >/dev/null 2>&1 || need+=(ffmpeg)
command -v git >/dev/null 2>&1 || need+=(git)
if [ ${#need[@]} -gt 0 ]; then
  echo "  Installing ${need[*]} (one time, a few minutes)..."
  brew install "${need[@]}" || stop "The install failed. Send the error above to Claude."
fi

# The office's own Python (Homebrew's Python refuses pip installs outside one); its folder also gives the agents `python`.
VENV="$HOME/.agent-hq-office"
if [ ! -x "$VENV/bin/python" ]; then
  python3.12 -m venv "$VENV" || stop "Couldn't make Agent HQ's Python. Send the error above to Claude."
fi

if ! command -v claude >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/claude" ]; then
  echo
  echo "  Atlas and the team run on Claude Code with your Claude subscription."
  if ask "Install Claude Code now (Anthropic's official installer)?"; then
    curl -fsSL https://claude.ai/install.sh | bash
  else
    echo "  Skipped: the backup Atlas (API) answers until Claude Code is installed."
  fi
fi

# Rhubarb (the lip-sync tool) is built for Intel Macs; an M-chip Mac runs it through Apple's Rosetta.
if [ "$(uname -m)" = "arm64" ] && ! /usr/bin/arch -x86_64 /usr/bin/true >/dev/null 2>&1 && [ ! -f .rosetta-skip ]; then
  echo
  echo "  The lip-sync tool needs Apple's Rosetta on this Mac (without it the mouths are simpler)."
  if ask "Install Rosetta now? (Apple asks you to accept its licence)"; then
    softwareupdate --install-rosetta
  else
    touch .rosetta-skip
  fi
fi

# Shipping Ghassan's changes and Richard's feedback push to GitHub: GitHub's sign-in helper opens the browser once.
if [ ! -f .gcm-skip ] && ! git config --global credential.helper >/dev/null 2>&1; then
  echo
  echo "  Ship (Ghassan's changes) and Richard's feedback save to GitHub, which needs a one-time GitHub sign-in."
  if ask "Install GitHub's sign-in helper now? (asks your Mac password)"; then
    brew install --cask git-credential-manager || echo "  It didn't install; Ship will say so until it does."
  else
    touch .gcm-skip
  fi
fi

# The voice matcher asked for BlackHole (a free virtual sound input, so the Mac can record what it plays).
if [ -f .want-blackhole ]; then
  echo
  echo "  BlackHole lets Agent HQ record what your Mac plays (for voice matching). It asks your Mac password."
  if ask "Install BlackHole now?"; then
    brew install --cask blackhole-2ch && rm -f .want-blackhole && {
      echo "  Installed. One time: open Audio MIDI Setup, click + (bottom left) > Create Multi-Output Device,"
      echo "  tick your speakers AND BlackHole 2ch. When you play a video for voice matching, choose that"
      echo "  Multi-Output Device as the sound output (menu bar speaker icon). macOS will ask to allow the microphone: allow it."
      read -r -p "  Press Enter to continue." _
    }
  else
    rm -f .want-blackhole
  fi
fi

"$VENV/bin/python" launch.py "$@"
echo
read -r -p "  Press Enter to close." _
