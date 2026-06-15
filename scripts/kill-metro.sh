#!/usr/bin/env bash
# Kill Metro bundler processes by name

DRY_RUN=0
COMMON_PORTS_FALLBACK=0
COMMON_PORTS="8081 8082 8083 19000 19001"
COMMON_PORT_FILTER="8081,8082,8083,19000,19001"
METRO_PROCESS_PATTERN='(^|[/[:space:]])metro([/[:space:]]|$)|react-native/cli'

usage() {
  echo "Usage: $0 [--dry-run] [--common-ports]"
  echo
  echo "Options:"
  echo "  --dry-run      Print matching processes without killing them"
  echo "  --common-ports Skip the prompt and include common Metro/Expo ports when no named process is found"
  echo "  -h, --help     Show this help"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --common-ports)
      COMMON_PORTS_FALLBACK=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac

  shift
done

ports_for_pid() {
  local pid="$1"
  local ports
  ports=$(lsof -nP -a -p "$pid" -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 { ports = ports ? ports ", " $9 : $9 } END { print ports }')

  if [ -n "$ports" ]; then
    echo "$ports"
  else
    echo "no listening TCP ports found"
  fi
}

print_and_kill_pid() {
  local pid="$1"
  local command="$2"
  local ports

  ports=$(ports_for_pid "$pid")
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "Would kill PID $pid ($command) on: $ports"
    return
  fi

  if kill "$pid" 2>/dev/null; then
    echo "Killed PID $pid ($command) on: $ports"
  else
    echo "Failed to kill PID $pid ($command) on: $ports"
  fi
}

handle_common_ports() {
  local port_pids
  port_pids=$(lsof -nP -t -iTCP:"$COMMON_PORT_FILTER" -sTCP:LISTEN 2>/dev/null | sort -u || true)

  if [ -z "$port_pids" ]; then
    echo "No processes found on common Metro/Expo ports"
    exit 0
  fi

  echo "$port_pids" | while read -r pid; do
    [ -n "$pid" ] || continue
    command=$(ps -p "$pid" -o command= 2>/dev/null || true)
    print_and_kill_pid "$pid" "$command"
  done

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "Dry run complete; no processes on common Metro/Expo ports killed"
  else
    echo "Processes on common Metro/Expo ports killed"
  fi
}

metro_pids=$(pgrep -f "$METRO_PROCESS_PATTERN" 2>/dev/null || true)

if [ -n "$metro_pids" ]; then
  echo "$metro_pids" | while read -r pid; do
    [ -n "$pid" ] || continue
    command=$(ps -p "$pid" -o command= 2>/dev/null || true)
    print_and_kill_pid "$pid" "$command"
  done

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "Dry run complete; no Metro processes killed"
  else
    echo "Metro processes killed"
  fi
  exit 0
fi

echo "No Metro or React Native CLI processes found."
echo "Common Metro/Expo ports: $COMMON_PORTS"
if [ "$COMMON_PORTS_FALLBACK" -eq 1 ]; then
  handle_common_ports
  exit 0
fi

if [ "$DRY_RUN" -eq 1 ]; then
  printf "Try finding processes listening on these common ports? [y/N] "
else
  printf "Try killing processes listening on these common ports? [y/N] "
fi
read -r answer

case "$answer" in
  [yY]|[yY][eE][sS])
    handle_common_ports
    ;;
  *)
    echo "No processes killed"
    ;;
esac
