"""Guards for outbound requests to user-supplied URLs (media to download,
webhooks to post to). Job params are user-controlled, so without this a
worker could be pointed at cloud metadata (169.254.169.254) or services on
the worker's private network and made to upload the response publicly."""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024  # 100 MB


class UnsafeUrlError(ValueError):
    pass


def _is_public(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
        or (isinstance(addr, ipaddress.IPv4Address) and addr in ipaddress.ip_network("100.64.0.0/10"))
    )


def assert_public_http_url(url: str) -> str:
    """Raises UnsafeUrlError unless `url` is http(s) and every address its
    host resolves to is publicly routable."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise UnsafeUrlError(f"not an http(s) URL: {url!r}")
    if parsed.username or parsed.password:
        raise UnsafeUrlError("URLs with embedded credentials are not allowed")
    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise UnsafeUrlError(f"could not resolve host {parsed.hostname!r}") from exc
    for info in infos:
        ip = info[4][0]
        if not _is_public(ip):
            raise UnsafeUrlError(f"URL host {parsed.hostname!r} resolves to a non-public address ({ip})")
    return url


def fetch_public_url(url: str, timeout: int = 60, max_bytes: int = MAX_DOWNLOAD_BYTES) -> bytes:
    """GETs a user-supplied URL after validating it. Redirects are refused
    (they could bounce to an internal address) and the body is size-capped."""
    import requests

    assert_public_http_url(url)
    with requests.get(url, timeout=timeout, stream=True, allow_redirects=False) as res:
        if 300 <= res.status_code < 400:
            raise UnsafeUrlError("redirects are not followed for user-supplied media URLs")
        res.raise_for_status()
        chunks, total = [], 0
        for chunk in res.iter_content(64 * 1024):
            total += len(chunk)
            if total > max_bytes:
                raise UnsafeUrlError(f"media exceeds {max_bytes // (1024 * 1024)} MB limit")
            chunks.append(chunk)
        return b"".join(chunks)
