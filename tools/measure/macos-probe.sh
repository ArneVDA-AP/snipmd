#!/bin/bash
# Phase 7a spike (PLAN.md): what a macOS runner can drive in the real SnipMD app, and how today's
# build behaves there. Each probe prints one line "<name>: PASS|FAIL|BLOCKED - <detail>" and the
# script always finishes, so one blocked permission never hides the other answers.
# Every launch uses its own data folder (SNIPMD_DATA_DIR); screenshots go to <out>.
# Exits 1 only when the harness itself is broken (no app, the app does not start); a probe that
# finds a known gap still exits 0.
#
#   tools/measure/macos-probe.sh <path to SnipMD.app> <out folder>
set -u
APP="$(cd "$1" && pwd)" || { echo "No app at $1"; exit 1; }
mkdir -p "$2"
OUT="$(cd "$2" && pwd)"
plist() { /usr/libexec/PlistBuddy -c "Print :$1" "$APP/Contents/Info.plist"; }
BIN="$APP/Contents/MacOS/$(plist CFBundleExecutable)"
ID="$(plist CFBundleIdentifier)"
[ -x "$BIN" ] || { echo "No executable at $BIN"; exit 1; }
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
# Returns 2 when the app was not running, 1 when it had to be killed.
quit_app() {
  kill -0 "$PID" 2>/dev/null || return 2
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
  exit 1
fi
quit_app
case $? in
  0) report quit-event PASS "quit Apple Event ended the app" ;;
  1) report quit-event FAIL "still running after 10 s, killed" ;;
  *) report quit-event FAIL "the app had already ended" ;;
esac

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

# Types $2 in a fresh app (data folder $1), runs $3 to quit 0.2 s later, and reports whether the
# text reached session.json. Keystrokes queue behind the HID event queue while a quit Apple Event
# arrives directly, so without the pause a Dock quit would overtake the typing. 0.2 s stays well
# inside the 500 ms session debounce, so only the quit's flush can save the text.
typed_then_quit() {
  start "$1"
  osascript -e "tell application id \"$ID\" to activate" >/dev/null 2>&1
  sleep 1
  if ! osascript -e "tell application \"System Events\" to keystroke \"$2\"" -e "delay 0.2" -e "$3" 2>/dev/null; then
    quit_app
    report "$1" BLOCKED "no keystrokes without Accessibility"
    return
  fi
  for _ in $(seq 1 20); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    report "$1" FAIL "still running 10 s after the quit"
  elif session | grep -q "$2"; then
    report "$1" PASS "text typed just before the quit is in session.json"
  else
    report "$1" FAIL "text typed just before the quit is missing (PLAN phase 7 item 1)"
  fi
}

echo "== Typing, then quit at once (SPEC §13: a quit flushes like a close)"
typed_then_quit quit-flush-cmdq flushcmdq 'tell application "System Events" to keystroke "q" using command down'
typed_then_quit quit-flush-dock flushdock "tell application id \"$ID\" to quit"

echo "== Cmd+W closes the tab, not the window (the menu bar)"
start close-tab
osascript -e "tell application id \"$ID\" to activate" >/dev/null 2>&1
sleep 1
if osascript -e 'tell application "System Events" to keystroke "w" using command down' 2>/dev/null; then
  sleep 2
  if kill -0 "$PID" 2>/dev/null; then
    report close-tab PASS "the app still runs after Cmd+W"
  else
    report close-tab FAIL "Cmd+W ended the app"
  fi
  shot 04-close-tab >/dev/null
  quit_app
else
  quit_app
  report close-tab BLOCKED "no keystrokes without Accessibility"
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
