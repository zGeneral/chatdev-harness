import pytest

from strutil import slugify


def test_basic_punctuation_and_spaces():
    assert slugify('Hello,  World!') == 'hello-world'


def test_dots_and_underscores():
    assert slugify('  A.B__C ') == 'a-b-c'


def test_already_slug():
    assert slugify('already-a-slug') == 'already-a-slug'


def test_leading_trailing_non_alnum():
    assert slugify('!!!Hello!!!') == 'hello'
    assert slugify('---trim---') == 'trim'


def test_lowercases():
    assert slugify('ABCdef') == 'abcdef'


def test_numbers_preserved():
    assert slugify('Item 42 of 100') == 'item-42-of-100'


def test_empty_string():
    assert slugify('') == ''


def test_only_non_alnum():
    assert slugify('!!!') == ''
    assert slugify('   ') == ''


def test_whitespace_runs():
    assert slugify('a \t\n b') == 'a-b'


def test_single_word():
    assert slugify('Word') == 'word'
