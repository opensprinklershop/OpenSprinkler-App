#!/bin/bash

cd build/firmware

ACTION="$1"

if [ -z "$ACTION" ]; then
	echo "Usage: bash test/launch_ospi.sh <start|stop>"
	exit 1
fi

if [ "$ACTION" = "start" ]; then
	if [ ! -d "sip" ]; then
		echo "SIP repository fehlt, klone nach build/firmware/sip ..."
		git clone https://github.com/dan-in-ca/sip
	fi
	cd sip
	# Clean up stale PID file or already running SIP simulator processes.
	if [ -f "pid" ]; then
		OLD_PID=$(cat pid)
		if [ -n "$OLD_PID" ] && ps -p "$OLD_PID" >/dev/null 2>&1; then
			kill "$OLD_PID" >/dev/null 2>&1 || true
			sleep 1
		fi
		rm -f pid
	fi
	PORT_PIDS=$(lsof -tiTCP:8080 -sTCP:LISTEN 2>/dev/null)
	if [ -n "$PORT_PIDS" ]; then
		for p in $PORT_PIDS; do
			kill "$p" >/dev/null 2>&1 || true
		done
	fi
	sleep 1
	#Change port to 8080
	sed -ibak "s/\"htp\": 80,/\"htp\": 8080,/" gv.py
	if command -v python >/dev/null 2>&1; then
		PYTHON_BIN="python"
	elif command -v python3 >/dev/null 2>&1; then
		PYTHON_BIN="python3"
	else
		echo "Error: Neither python nor python3 found in PATH."
		exit 1
	fi
	nohup "$PYTHON_BIN" sip.py >/dev/null 2>&1 &
	sleep 5
	NEW_PID=$(lsof -tiTCP:8080 -sTCP:LISTEN 2>/dev/null | head -n 1)
	if [ -z "$NEW_PID" ]; then
		echo "Error: SIP simulator did not stay running (check port 8080 availability)."
		exit 1
	fi
	echo "$NEW_PID" > pid
	echo "SIP simulator gestartet: PID $NEW_PID, URL http://127.0.0.1:8080"
elif [ "$ACTION" = "stop" ]; then
	if [ -f "sip/pid" ]; then
		STOP_PID=$(cat sip/pid)
		if [ -n "$STOP_PID" ] && ps -p "$STOP_PID" >/dev/null 2>&1; then
			kill "$STOP_PID" >/dev/null 2>&1 || true
			sleep 1
		fi
		rm -f sip/pid
	fi
	PORT_PIDS=$(lsof -tiTCP:8080 -sTCP:LISTEN 2>/dev/null)
	if [ -n "$PORT_PIDS" ]; then
		for p in $PORT_PIDS; do
			kill "$p" >/dev/null 2>&1 || true
		done
	fi
	sleep 5
	echo "SIP simulator gestoppt."
else
	echo "Unknown action: $ACTION"
	echo "Usage: bash test/launch_ospi.sh <start|stop>"
	exit 1
fi
