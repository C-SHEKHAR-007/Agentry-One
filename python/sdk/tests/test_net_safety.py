import pytest

from sdk.net_safety import UnsafeUrlError, assert_public_http_url


@pytest.mark.parametrize(
    "url",
    [
        "http://169.254.169.254/latest/meta-data/",
        "http://127.0.0.1:4000/artifacts",
        "http://10.1.2.3/",
        "http://192.168.0.1/",
        "http://[::1]/",
        "http://[::ffff:169.254.169.254]/",
        "http://0.0.0.0/",
        "http://100.64.0.1/",
    ],
)
def test_blocks_internal_targets(url):
    with pytest.raises(UnsafeUrlError):
        assert_public_http_url(url)


@pytest.mark.parametrize("url", ["file:///etc/passwd", "ftp://8.8.8.8/x", "https://user:pw@8.8.8.8/"])
def test_rejects_bad_schemes_and_credentials(url):
    with pytest.raises(UnsafeUrlError):
        assert_public_http_url(url)


def test_allows_public_ip():
    assert assert_public_http_url("https://8.8.8.8/image.png") == "https://8.8.8.8/image.png"
