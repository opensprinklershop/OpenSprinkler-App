import os, signal
me = os.getpid()
for pid in os.listdir('/proc'):
    if not pid.isdigit() or int(pid) == me: continue
    try:
        args = open(f'/proc/{pid}/cmdline','rb').read().split(b'\0')
    except Exception: continue
    if not args or not args[0]: continue
    exe = os.path.basename(args[0]).decode(errors='ignore')
    line = b' '.join(args).decode(errors='ignore')
    kill = False
    if exe.startswith('chromium') and 'cdp/profile' in line: kill = True
    if exe.startswith('python3') and len(args) > 3 and args[1] == b'-m' and args[2] == b'http.server' and args[3] == b'8765': kill = True
    if kill:
        try: os.kill(int(pid), signal.SIGTERM); print('killed', pid, exe)
        except Exception as e: print('fail', pid, e)
