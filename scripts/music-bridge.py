"""Run the separately installed CloudMusic Local API on loopback."""
from pathlib import Path
import importlib.util
import os
import threading

root = Path(__file__).resolve().parents[1] / '.cache' / 'netease-bridge'
if not (root / 'main.py').is_file():
    raise SystemExit('Missing local music bridge. See docs/MUSIC_SETUP.md.')
os.chdir(root)
spec = importlib.util.spec_from_file_location('local_netease_bridge', root / 'main.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


@bridge.app.before_request
def check_local_request():
    allowed = {'http://127.0.0.1:18726', 'http://localhost:18726'}
    if 'http://' + bridge.request.host not in allowed:
        return bridge.Response('Host not allowed', status=403)
    if bridge.request.headers.get('Origin') and bridge.request.headers['Origin'] not in allowed:
        return bridge.Response('Origin not allowed', status=403)


if __name__ == '__main__':
    threading.Thread(target=bridge.monitor_loop, args=(bridge.v3, bridge.lrc_svc, bridge.offset_resolver), daemon=True).start()
    bridge.app.run(host='127.0.0.1', port=18726, debug=False)
