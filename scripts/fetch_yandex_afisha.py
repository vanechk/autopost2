#!/usr/bin/env python3
"""Fetch a Yandex Afisha page with a browser-compatible TLS fingerprint."""

import sys
from urllib.parse import urlparse

from curl_cffi import requests


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: fetch_yandex_afisha.py <afisha-url>")

    url = sys.argv[1]
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "afisha.yandex.ru":
        raise SystemExit("Only https://afisha.yandex.ru URLs are allowed")

    response = requests.get(
        url,
        impersonate="chrome",
        headers={
            "Accept-Language": "ru-RU,ru;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout=30,
    )
    response.raise_for_status()

    if "Вы не робот?" in response.text or "__APOLLO_STATE__" not in response.text:
        raise SystemExit("Yandex Afisha did not return an event page")

    sys.stdout.write(response.text)


if __name__ == "__main__":
    main()
