"""Source verifier regressions in disposable Git repositories, not release refs."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


VERIFIER = Path(__file__).with_name('verify-documentation.py')


class DocumentationVerifierTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='veil-doc-verifier-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.write('docs/keep.md', '# Keep\n[Target](target.md#existing)\n')
        self.write('docs/target.md', '# Existing\n')
        self.write('docs/retired.md', '# Retired\n[Old](never-existed.md)\n')
        self.write('docs/_data/navigation.yml', 'pages:\n  - title: Keep\n    url: /keep.html\n')
        self.write('docs/index.html', "<a href=\"{{ '/keep.html' | relative_url }}\">Keep</a>\n")
        self.write('docs/_layouts/docs.html', "<a href=\"{{ '/keep.html' | relative_url }}\">Keep</a>\n")
        self.write('tools/verify-documentation.py', VERIFIER.read_text())
        self.git('init', '-q')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                 'commit', '-qm', 'fixture baseline')
        self.git('tag', 'v0.3.1')
        (self.root / 'docs/retired.md').unlink()
        self.write('docs/keep.md', '# Keep\n[Target](target.md#existing)\nUpdated.\n')

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def git(self, *args):
        subprocess.run(['git', *args], cwd=self.root, check=True,
                       capture_output=True, text=True)

    def verify(self):
        return subprocess.run([sys.executable, 'tools/verify-documentation.py'],
                              cwd=self.root, capture_output=True, text=True)

    def assert_failure(self, expected):
        result = self.verify()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(expected, result.stdout)
        self.assertNotIn('Traceback', result.stderr)

    def test_deleted_markdown_is_not_read(self):
        result = self.verify()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('1 changed Markdown documents', result.stdout)

    def test_surviving_link_to_deleted_markdown_still_fails(self):
        self.write('docs/keep.md', '# Keep\n[Retired](retired.md)\n')
        self.assert_failure('docs/keep.md: missing retired.md')

    def test_remaining_fragment_validation_still_runs(self):
        self.write('docs/keep.md', '# Keep\n[Target](target.md#absent)\n')
        self.assert_failure('missing fragment target.md#absent')

    def test_navigation_validation_still_runs(self):
        self.write('docs/_data/navigation.yml', 'pages:\n  - title: Retired\n    url: /retired.html\n')
        self.assert_failure('docs/_data/navigation.yml: missing /retired.html')

    def test_template_validation_still_runs(self):
        for template in ['docs/index.html', 'docs/_layouts/docs.html']:
            with self.subTest(template=template):
                original = (self.root / template).read_text()
                self.write(template, "<a href=\"{{ '/retired.html' | relative_url }}\">Retired</a>\n")
                self.assert_failure(template + ': missing /retired.html')
                self.write(template, original)

    def test_untracked_markdown_validation_still_runs(self):
        self.write('docs/new.md', '# New\n[Missing](missing.md)\n')
        self.assert_failure('docs/new.md: missing missing.md')


if __name__ == '__main__':
    unittest.main()
