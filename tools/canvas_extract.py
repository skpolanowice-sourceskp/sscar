import io, sys
s = io.open('geometria-3d.html', encoding='utf-8').read().split('\n')
hdr = next(i for i,l in enumerate(s) if 'LABORATORIUM GEOMETRII' in l and 'symulator ko' in l)
a = next(i for i in range(hdr, len(s)) if s[i].startswith('(function(){'))
b = next(i for i in range(a, len(s)) if s[i].strip() == '})();')
io.open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(s[a:b+1]))
print('JS linie %d..%d (%d linii)' % (a+1, b+1, b-a+1))
