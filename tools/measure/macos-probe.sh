#!/bin/bash
# Phase 7a spike (PLAN.md): what a macOS runner can drive in the real SnipMD app, and how today's
# build behaves there. Each probe prints one line "<name>: PASS|FAIL|BLOCKED - <detail>" and the
# script always finishes, so one blocked permission never hides the other answers.
# Every launch uses its own data folder (SNIPMD_DATA_DIR); screenshots go to <out>.
#
#   tools/measure/macos-probe.sh <path to SnipMD.app> <out folder>
set -u
APP="$1"
OUT="$2"
mkdir -p "$OUT"
BIN="$APP/Contents/MacOS/$(defaults read "$APP/Contents/Info.plist" CFBundleExecutable)"
ID="$(defaults read "$APP/Contents/Info.plist" CFBundleIdentifier)"
WORK="$(mktemp -d)"
PID=""

report() { echo "$1: $2 - $3"; }

# Starts the app binary with a fresh data folder (named $1) and waits for its window.
start() {
  DATA="$WORK/$1"
  mkdir -p "$DATA"
  SNIPMD_DATA_DIR="$DATA" SNIPMD_TRACE=1 "$BIN" >"$WORK/$1.log" 2>&1 &
  PID=$!
  for _ in $(seq 1 40); do
    if osascript -e "tell application \"System Events\" to count windows of (first process whose unix id is $PID)" 2>/dev/null | grep -q '^[1-9]'; then
      sleep 2 # first paint and session restore
      return 0
    fi
    sleep 0.5
  done
  sleep 5 # no System Events: give it time anyway
}

# Asks the app to quit the way Cmd+Q does (a quit Apple Event) and waits up to 10 s.
quit_app() {
  osascript -e "tell application id \"$ID\" to quit" >/dev/null 2>&1
  for _ in $(seq 1 20); do
    kill -0 "$PID" 2>/dev/null || return 0
    sleep 0.5
  done
  kill "$PID" 2>/dev/null
  return 1
}

shot() { screencapture -x "$OUT/$1.png" 2>/dev/null && echo "$OUT/$1.png" || echo "none"; }

session() { cat "$DATA/session.json" 2>/dev/null; }

echo "== Runner"
sw_vers
uname -m
echo "Bundle: $ID, binary $(lipo -archs "$BIN" 2>/dev/null)"
codesign -dv "$APP" 2>&1 | grep -E 'Signature|flags' || true

echo "== Permissions"
if screencapture -x "$WORK/probe.png" 2>/dev/null && [ -s "$WORK/probe.png" ]; then
  report screen-capture PASS "screencapture wrote a file (whether windows show in it: see the screenshots)"
else
  report screen-capture BLOCKED "screencapture failed"
fi
ax=$(osascript -e 'tell application "System Events" to get UI elements enabled' 2>&1)
if [ "$ax" = "true" ]; then
  report accessibility PASS "System Events may send keys"
else
  report accessibility BLOCKED "UI elements enabled: $ax"
fi

echo "== Launch"
start launch
if kill -0 "$PID" 2>/dev/null; then
  report launch PASS "running, screenshot $(shot 01-launch)"
else
  report launch FAIL "process ended; log: $(tail -5 "$WORK/launch.log" | tr '\n' ' ')"
fi
quit_app && report quit-event PASS "quit Apple Event ended the app" || report quit-event FAIL "still running after 10 s, killed"

echo "== Open from Finder (LaunchServices Apple Event, as a double-click)"
start open
NOTE="$WORK/finder-open.md"
printf '# Opened from Finder\n' >"$NOTE"
open -a "$APP" "$NOTE"
sleep 3
shot 02-open >/dev/null
quit_app
if session | grep -q 'finder-open.md'; then
  report finder-open PASS "the note is a tab in session.json"
else
  report finder-open FAIL "the note is not in session.json (RunEvent::Opened not handled, PLAN phase 7 item 2)"
fi

echo "== Typing, then quit at once (the Cmd+Q flush)"
start type
osascript -e "tell application id \"$ID\" to activate" >/dev/null 2>&1
sleep 1
if osascript -e 'tell application "System Events" to keystroke "flushcheck"' 2>/dev/null; then
  quit_app
  if session | grep -q 'flushcheck'; then
    report quit-flush PASS "text typed just before quit is in session.json"
  else
    report quit-flush FAIL "text typed just before quit is missing (PLAN phase 7 item 1)"
  fi
else
  quit_app
  report quit-flush BLOCKED "no keystrokes without Accessibility"
fi

echo "== Paste a screenshot (Cmd+V with only a PNG on the clipboard)"
start paste
PNG="$WORK/clip.png"
screencapture -x -R0,0,640,360 "$PNG" 2>/dev/null || cp "$WORK/probe.png" "$PNG" 2>/dev/null
if [ -s "$PNG" ] && osascript -e "set the clipboard to (read (POSIX file \"$PNG\") as «class PNGf»)" 2>/dev/null; then
  osascript -e "tell application id \"$ID\" to activate" >/dev/null 2>&1
  sleep 1
  if osascript -e 'tell application "System Events" to keystroke "v" using command down' 2>/dev/null; then
    sleep 2
    shot 03-paste >/dev/null
    quit_app
    found=$(find "$DATA/scratch" -name 'snip-*.png' 2>/dev/null | head -1)
    if [ -n "$found" ]; then
      report paste PASS "WKWebView handed over the image; saved as $(basename "$found")"
    else
      report paste FAIL "no image saved in scratch (clipboardData without image/png, or Cmd+V not reaching the page)"
    fi
  else
    quit_app
    report paste BLOCKED "no keystrokes without Accessibility"
  fi
else
  quit_app
  report paste BLOCKED "could not put a PNG on the clipboard"
fi

echo "== Logs"
for f in "$WORK"/*.log; do echo "-- $(basename "$f")"; tail -20 "$f"; done
