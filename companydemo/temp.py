"""Temperature conversion utilities."""


def celsius_to_fahrenheit(c: float) -> float:
    """Convert Celsius to Fahrenheit, rounded to 2 decimal places."""
    return round(c * 9 / 5 + 32, 2)


def fahrenheit_to_celsius(f: float) -> float:
    """Convert Fahrenheit to Celsius, rounded to 2 decimal places."""
    return round((f - 32) * 5 / 9, 2)
