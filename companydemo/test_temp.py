import pytest

from temp import celsius_to_fahrenheit, fahrenheit_to_celsius


def test_freezing_point():
    assert celsius_to_fahrenheit(0) == 32.0


def test_boiling_point():
    assert celsius_to_fahrenheit(100) == 212.0


def test_minus_forty_equal():
    assert celsius_to_fahrenheit(-40) == -40.0


def test_body_temperature():
    assert celsius_to_fahrenheit(37) == 98.6


def test_fahrenheit_to_celsius_freezing():
    assert fahrenheit_to_celsius(32) == 0.0


def test_fahrenheit_to_celsius_boiling():
    assert fahrenheit_to_celsius(212) == 100.0


def test_fahrenheit_to_celsius_minus_forty():
    assert fahrenheit_to_celsius(-40) == -40.0


def test_fahrenheit_to_celsius_body():
    assert fahrenheit_to_celsius(98.6) == 37.0


@pytest.mark.parametrize("c", [0.0, 25.0, 37.0, 100.0, -10.0])
def test_round_trip(c):
    assert fahrenheit_to_celsius(celsius_to_fahrenheit(c)) == c
