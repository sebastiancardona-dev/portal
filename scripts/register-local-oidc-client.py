#!/usr/bin/env python3
"""Headless local-dev variant of ops/admin-token.py: logs in as the seeded local
admin with a cookie session, drives the PKCE code flow without a browser (the
authorize redirect Location is read instead of followed), then registers the
`portal` OIDC client and prints its one-time secret as JSON."""

import base64
import hashlib
import html
import http.cookiejar
import json
import re
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request

ISSUER = "http://localhost:9000"
ADMIN = ("juanse@local.dev", "local-admin-password")
CLIENT_ID = "admin-cli"
REDIRECT = "http://127.0.0.1:8484/callback"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect)


def request(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        return opener.open(req)
    except urllib.error.HTTPError as e:
        return e  # 3xx/4xx responses still carry the headers we need


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


# 1. login form → CSRF token → POST credentials (session cookie lands in the jar)
page = request(f"{ISSUER}/login").read().decode()
csrf = html.unescape(re.search(r'name="_csrf"\s+value="([^"]+)"', page).group(1))
resp = request(f"{ISSUER}/login", data=urllib.parse.urlencode({
    "username": ADMIN[0], "password": ADMIN[1], "_csrf": csrf}).encode())
location = resp.headers.get("Location", "")
if "error" in location:
    sys.exit(f"login failed: {location}")

# 2. authorize with PKCE → the redirect Location carries the code (nothing on :8484)
verifier = b64url(secrets.token_bytes(48))
challenge = b64url(hashlib.sha256(verifier.encode()).digest())
state = b64url(secrets.token_bytes(16))
authorize = f"{ISSUER}/oauth2/authorize?" + urllib.parse.urlencode({
    "response_type": "code", "client_id": CLIENT_ID, "redirect_uri": REDIRECT,
    "scope": "openid profile", "state": state,
    "code_challenge": challenge, "code_challenge_method": "S256"})
resp = request(authorize)
location = resp.headers.get("Location", "")
query = urllib.parse.parse_qs(urllib.parse.urlparse(location).query)
if "code" not in query:
    sys.exit(f"authorize failed: {location or resp.status}")
assert query["state"][0] == state, "state mismatch"

# 3. exchange the code
resp = request(f"{ISSUER}/oauth2/token", data=urllib.parse.urlencode({
    "grant_type": "authorization_code", "code": query["code"][0],
    "redirect_uri": REDIRECT, "client_id": CLIENT_ID, "code_verifier": verifier,
}).encode(), headers={"Content-Type": "application/x-www-form-urlencoded"})
token = json.load(resp)["access_token"]

# 4. register the portal client (idempotence: a 409/400 means it already exists)
body = json.dumps({
    "clientId": "portal", "name": "Portal", "confidential": True,
    "redirectUris": [
        "http://localhost:5173/login/oauth2/code/ecosystem",
        "http://localhost:8080/login/oauth2/code/ecosystem",
    ],
    "postLogoutRedirectUris": ["http://localhost:5173", "http://localhost:8080"],
}).encode()
resp = request(f"{ISSUER}/api/admin/clients", data=body, headers={
    "Content-Type": "application/json", "Authorization": f"Bearer {token}"})
print(resp.read().decode())
