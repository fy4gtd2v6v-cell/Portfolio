"""Liest Lua-Tabellenliterale als reine Daten (fuehrt keinen Lua-Code aus)."""
import re

NUM = re.compile(r'-?(0x[0-9a-fA-F]+|\d+\.?\d*(e-?\d+)?|\.\d+)')
IDENT_ASSIGN = re.compile(r'([A-Za-z_]\w*)\s*=(?!=)')
DIGITS = re.compile(r'\d{1,3}')


class P:
    def __init__(s, t):
        s.t = t; s.i = 0; s.n = len(t)

    def ws(s):
        t = s.t
        while s.i < s.n:
            c = t[s.i]
            if c in ' \t\r\n':
                s.i += 1
            elif t.startswith('--', s.i):
                if t.startswith('--[[', s.i):
                    s.i = t.index(']]', s.i) + 2
                else:
                    j = t.find('\n', s.i); s.i = s.n if j < 0 else j + 1
            else:
                break

    def val(s):
        s.ws(); t = s.t; c = t[s.i]
        if c == '{':
            return s.table()
        if c in '"\'':
            return s.string()
        if t.startswith('[[', s.i):
            j = t.index(']]', s.i); v = t[s.i + 2:j]; s.i = j + 2; return v
        m = NUM.match(t, s.i)
        if m:
            s.i = m.end(); x = m.group(0)
            if 'x' in x:
                return int(x, 16)
            return float(x) if ('.' in x or 'e' in x) else int(x)
        for w, v in (('nil', None), ('true', True), ('false', False)):
            if t.startswith(w, s.i):
                s.i += len(w); return v
        raise ValueError('unexpected %r at %d' % (t[s.i:s.i + 40], s.i))

    def string(s):
        t = s.t; q = t[s.i]; s.i += 1; out = []
        while True:
            c = t[s.i]
            if c == q:
                s.i += 1; return ''.join(out)
            if c == '\\':
                d = t[s.i + 1]
                if d.isdigit():
                    m = DIGITS.match(t, s.i + 1); out.append(chr(int(m.group(0)))); s.i = m.end()
                else:
                    out.append({'n': '\n', 't': '\t'}.get(d, d)); s.i += 2
            else:
                out.append(c); s.i += 1

    def table(s):
        s.i += 1; d = {}; pos = 1; t = s.t; explicit = False
        while True:
            s.ws()
            if t[s.i] == '}':
                s.i += 1; break
            if t[s.i] == '[' and not t.startswith('[[', s.i):
                s.i += 1; k = s.val(); s.ws(); assert t[s.i] == ']'; s.i += 1
                s.ws(); assert t[s.i] == '='; s.i += 1
                d[k] = s.val(); explicit = True
            else:
                m = IDENT_ASSIGN.match(t, s.i)
                if m:
                    s.i = m.end(); d[m.group(1)] = s.val(); explicit = True
                else:
                    d[pos] = s.val(); pos += 1
            s.ws()
            if s.i < s.n and t[s.i] in ',;':
                s.i += 1
        if not explicit and d and all(isinstance(k, int) for k in d) and set(d) == set(range(1, len(d) + 1)):
            return [d[k] for k in range(1, len(d) + 1)]
        return d if (d or explicit) else []


def parse_assignment(text, name):
    """Liest 'name = {...}' oder 'name = [[return {...}]]' / loadstring([[return {...}]])."""
    i = text.index(name)
    j = text.index('=', i + len(name)) + 1
    rest = text[j:j + 40].lstrip()
    if rest.startswith('[[') or rest.startswith('loadstring'):
        k = text.index('return', j) + 6
        return P(text[k:]).val()
    return P(text[j:]).val()
