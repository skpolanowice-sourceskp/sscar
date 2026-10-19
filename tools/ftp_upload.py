"""Wgrywa pliki na serwer vh.pl przez FTP i weryfikuje je odczytem z powrotem.

Uruchamiaj z korzenia repo:
    python tools/ftp_upload.py index.html js/rezerwacja.js reservations/lib.php

Ścieżki podawaj względem korzenia — trafiają na serwer pod tymi samymi ścieżkami.
Dane logowania czyta z .vscode/sftp.json (nigdy nie wpisuj hasła w komendę).
ftplib z encoding='utf-8' obsługuje też polskie znaki w nazwach (FtpWebRequest z .NET ich nie obsługuje).
Brakujące katalogi zakłada przez MKD. Pliki spoza web rootu (tools/, docs/, img/_src/, *.md, ...) odrzuca.
"""
import ftplib
import io
import json
import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FORBIDDEN = re.compile(r'^(tools/|docs/|img/_src/|\.vscode/|\.git/|\.claude/)|\.(md|py)$|(^|/)config\.php$')


def load_config():
    raw = open(os.path.join(BASE_DIR, '.vscode', 'sftp.json'), encoding='utf-8').read()
    raw = re.sub(r'^\s*//.*$', '', raw, flags=re.M)
    return json.loads(raw)


def ensure_dir(ftp, remote_dir):
    path = ''
    for part in [p for p in remote_dir.split('/') if p]:
        path += '/' + part
        try:
            ftp.cwd(path)
        except ftplib.error_perm:
            ftp.mkd(path)
    ftp.cwd('/')


def main(paths):
    if not paths:
        print(__doc__)
        return 2
    rel = [re.sub(r'^(\./)+', '', p.replace('\\', '/')) for p in paths]
    bad = [p for p in rel if FORBIDDEN.search(p)]
    if bad:
        print('Odmowa — tych plików nie wgrywamy na serwer:', ', '.join(bad))
        return 2
    cfg = load_config()
    base = cfg.get('remotePath', '/').rstrip('/')
    ftp = ftplib.FTP(cfg['host'], timeout=60)
    ftp.encoding = 'utf-8'
    ftp.login(cfg['username'], cfg['password'])
    failed = 0
    for p in rel:
        data = open(os.path.join(BASE_DIR, p), 'rb').read()
        remote = base + '/' + p
        ensure_dir(ftp, os.path.dirname(remote))
        ftp.storbinary('STOR ' + remote, io.BytesIO(data))
        back = io.BytesIO()
        ftp.retrbinary('RETR ' + remote, back.write)
        ok = back.getvalue() == data
        failed += not ok
        print(('OK      ' if ok else 'MISMATCH') + '  ' + p, flush=True)
    ftp.quit()
    print('%d/%d zweryfikowanych' % (len(rel) - failed, len(rel)))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
