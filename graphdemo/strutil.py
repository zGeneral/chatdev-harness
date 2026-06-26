"""String utilities."""
import re

_NON_ALNUM = re.compile(r'[^a-z0-9]+')


def slugify(s: str) -> str:
    """Convert a string into a URL-friendly slug.

    Lowercases the input, strips leading/trailing whitespace, and replaces
    every run of non-alphanumeric characters with a single hyphen. The result
    has no leading or trailing hyphens.
    """
    s = s.strip().lower()
    s = _NON_ALNUM.sub('-', s)
    return s.strip('-')
