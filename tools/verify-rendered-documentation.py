"""Check Jekyll's actual HTML output without deploying or contacting external sites.

Usage: python3 tools/verify-rendered-documentation.py /path/to/_site /veil
"""
from html.parser import HTMLParser
from pathlib import Path
import sys
from urllib.parse import unquote, urljoin, urlsplit


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.links = []
        self.tags = set()
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag)
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        if tag == 'a' and attrs.get('name'):
            self.ids.add(attrs['name'])
        for key in ('href', 'src'):
            if attrs.get(key):
                self.links.append(attrs[key])


def main():
    root = Path(sys.argv[1]).resolve()
    base = '/' + sys.argv[2].strip('/') if sys.argv[2].strip('/') else ''
    documents = {p: Document(p.read_text()) for p in root.rglob('*.html')}
    failures = []
    checked = 0
    if not documents or root / 'index.html' not in documents:
        failures.append('Missing rendered HTML/index.html')
    for source, document in sorted(documents.items()):
        label = source.relative_to(root).as_posix()
        if not {'html', 'head', 'title', 'body', 'nav', 'main'} <= document.tags:
            failures.append(f'{label}: missing document/layout structure')
        current = base + '/' + label
        for link in document.links:
            parsed = urlsplit(link)
            if parsed.scheme or parsed.netloc:
                continue
            resolved = urlsplit(urljoin(current, link))
            path = unquote(resolved.path)
            checked += 1
            if base and path != base and not path.startswith(base + '/'):
                failures.append(f'{label}: outside base URL: {link}')
                continue
            target = (root / path[len(base):].lstrip('/')).resolve()
            if not target.is_relative_to(root):
                failures.append(f'{label}: escapes output: {link}')
                continue
            if target.is_dir():
                target = target / 'index.html'
            if not target.is_file():
                failures.append(f'{label}: missing target: {link}')
            elif resolved.fragment and target in documents and unquote(resolved.fragment) not in documents[target].ids:
                failures.append(f'{label}: missing fragment: {link}')
    if failures:
        print('\n'.join(failures))
        return 1
    print(f'PASS: {len(documents)} rendered HTML pages; {checked} local links/assets/fragments; base URL {base or "/"}; document and navigation structure present.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
