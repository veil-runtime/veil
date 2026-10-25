# Source-only documentation check; does not substitute for rendered Jekyll validation.
from pathlib import Path
import re, subprocess, sys
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parent.parent
changed = subprocess.check_output(['git', 'diff', '--name-only', '--diff-filter=d', 'v0.3.1'], cwd=root, text=True).splitlines()
added = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard'], cwd=root, text=True).splitlines()
documents = sorted({root / name for name in changed + added if name.endswith('.md')})
failures = []
checked = 0

def check(source, link, site=False):
    global checked
    if not link or urlsplit(link).scheme or link.startswith('//'):
        return
    path, _, fragment = unquote(link).partition('#')
    target = (root / 'docs' / path.lstrip('/')) if site and path.startswith('/') else source.parent / path if path else source
    if target.suffix == '.html' and not target.exists():
        target = target.with_suffix('.md')
    if target.is_dir():
        target = target / 'index.html'
    checked += 1
    if not target.exists():
        failures.append(f'{source.relative_to(root)}: missing {link}')
        return
    if fragment:
        text = target.read_text()
        ids = set(re.findall(r'id=[\"\x27]([^\"\x27]+)', text))
        counts = {}
        for heading in re.findall(r'^#{1,6}\s+(.+)$', text, re.M):
            slug = re.sub(r'[^\w\s-]', '', heading.lower()).strip().replace(' ', '-')
            number = counts.get(slug, 0)
            counts[slug] = number + 1
            ids.add(slug if number == 0 else f'{slug}-{number}')
        if fragment not in ids:
            failures.append(f'{source.relative_to(root)}: missing fragment {link}')

for source in documents:
    text = re.sub(r'```.*?```|~~~.*?~~~', '', source.read_text(), flags=re.S)
    for link in re.findall(r'(?<!!)\[[^\]]+\]\(([^\s)]+)(?:\s+[^)]*)?\)', text):
        check(source, link)
navigation = root / 'docs/_data/navigation.yml'
for route in re.findall(r'^\s+url:\s*(\S+)', navigation.read_text(), re.M):
    check(navigation, route, True)
for name in ['docs/index.html', 'docs/_layouts/docs.html']:
    source = root / name
    for route in re.findall(r"['\"](/[^'\"]+)['\"]\s*\|\s*relative_url", source.read_text()):
        check(source, route, True)
if failures:
    print('\n'.join(failures))
    sys.exit(1)
print(f'PASS: {checked} source links/routes/fragments across {len(documents)} changed Markdown documents, navigation and current HTML templates. Rendered Jekyll output was not checked.')
