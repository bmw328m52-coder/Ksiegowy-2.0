#!/usr/bin/env python3
"""Certyfikat dystrybucyjny + profil App Store przez App Store Connect API.

Po co: nazwa certyfikatu „Apple Distribution: ARTUR GUŻESKI” zawiera „Ż”.
codesign/Xcode zapisuje ją w designated requirement w postaci NFD (Z + kropka),
a w certyfikacie jest NFC → „does not satisfy its designated Requirement” i
App Store Connect odrzuca build. Podpisujemy więc sami, z DR, w którym nazwa
jest wpisana bajt w bajt (hex) tak jak w certyfikacie.

Użycie: asc_signing.py <katalog_wyjściowy>
Env: ASC_KEY_ID, ASC_ISSUER_ID, KEY_PATH, APPLE_TEAM_ID, BUNDLE_ID
Wynik w katalogu: cert.p12 (hasło „ci”), profile.mobileprovision, dr.txt, cert_sha1
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

API = "https://api.appstoreconnect.apple.com/v1"
OUT = sys.argv[1]
TEAM = os.environ["APPLE_TEAM_ID"]
BUNDLE = os.environ["BUNDLE_ID"]
PROFILE_PREFIX = "LUVIANO CI"


def token():
    now = int(time.time())
    with open(os.environ["KEY_PATH"]) as f:
        key = f.read()
    return jwt.encode(
        {"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"},
        key, algorithm="ES256", headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"},
    )


def call(method, path, body=None):
    req = urllib.request.Request(
        API + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(f"::error::ASC {method} {path} → {e.code}: {e.read().decode()[:600]}")
        raise


def ci_key():
    """Klucz RSA wyliczany deterministycznie z sekretu ASC_KEY_P8.

    Ten sam klucz w każdym runie → certyfikat założony raz jest potem tylko
    odnajdywany (po kluczu publicznym), nic nie trzeba unieważniać ani usuwać.
    """
    with open(os.environ["KEY_PATH"], "rb") as f:
        seed = hmac.new(f.read().strip(), b"luviano-ci-distribution-v1", hashlib.sha256).digest()
    counter = 0

    def rand_bytes(n):
        nonlocal counter
        out = b""
        while len(out) < n:
            out += hashlib.sha256(seed + counter.to_bytes(8, "big")).digest()
            counter += 1
        return out[:n]

    def is_prime(n):
        if n % 2 == 0:
            return False
        for sp in (3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
            if n % sp == 0:
                return n == sp
        d, r = n - 1, 0
        while d % 2 == 0:
            d, r = d // 2, r + 1
        for _ in range(40):
            a = 2 + int.from_bytes(rand_bytes(128), "big") % (n - 3)
            x = pow(a, d, n)
            if x in (1, n - 1):
                continue
            for _ in range(r - 1):
                x = pow(x, 2, n)
                if x == n - 1:
                    break
            else:
                return False
        return True

    def prime():
        while True:
            n = int.from_bytes(rand_bytes(128), "big") | (3 << 1022) | 1
            if (n - 1) % 65537 and is_prime(n):
                return n

    e = 65537
    p, q = prime(), prime()
    d = pow(e, -1, (p - 1) * (q - 1))
    return rsa.RSAPrivateNumbers(
        p, q, d, rsa.rsa_crt_dmp1(d, p), rsa.rsa_crt_dmq1(d, q), rsa.rsa_crt_iqmp(p, q),
        rsa.RSAPublicNumbers(e, p * q),
    ).private_key()


def main():
    os.makedirs(OUT, exist_ok=True)

    # 1. Bundle ID (dokładne dopasowanie — filtr API dopasowuje też prefiksy).
    ids = call("GET", f"/bundleIds?filter[identifier]={BUNDLE}&limit=50")["data"]
    bundle = next((b for b in ids if b["attributes"]["identifier"] == BUNDLE), None)
    if not bundle:
        sys.exit(f"::error::Brak Bundle ID {BUNDLE} w developer.apple.com → Identifiers")

    # 2. Certyfikat Apple Distribution z naszym kluczem — istniejący albo nowy.
    key = ci_key()
    pub = key.public_key().public_numbers()
    cert = c = None
    for item in call("GET", "/certificates?filter[certificateType]=DISTRIBUTION&limit=200")["data"]:
        content = item["attributes"].get("certificateContent")
        if not content:
            continue
        cand = x509.load_der_x509_certificate(base64.b64decode(content))
        if cand.public_key().public_numbers() == pub:
            cert, c = item, cand
            break
    if cert:
        print(f"::notice::Używam istniejącego certyfikatu CI (wygasa {cert['attributes'].get('expirationDate')})")
    else:
        csr = x509.CertificateSigningRequestBuilder().subject_name(x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, "LUVIANO CI"),
            x509.NameAttribute(NameOID.COUNTRY_NAME, "PL"),
        ])).sign(key, hashes.SHA256()).public_bytes(serialization.Encoding.PEM).decode()
        cert = call("POST", "/certificates", {"data": {"type": "certificates", "attributes": {
            "certificateType": "DISTRIBUTION", "csrContent": csr}}})["data"]
        c = x509.load_der_x509_certificate(base64.b64decode(cert["attributes"]["certificateContent"]))
        print("::notice::Założony nowy certyfikat CI")

    # .p12 w starym szyfrowaniu (3DES/SHA1) — `security import` na macOS nie
    # czyta nowszych wariantów.
    enc = (serialization.PrivateFormat.PKCS12.encryption_builder()
           .kdf_rounds(50000)
           .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC)
           .hmac_hash(hashes.SHA1()).build(b"ci"))
    with open(os.path.join(OUT, "cert.p12"), "wb") as f:
        f.write(pkcs12.serialize_key_and_certificates(b"LUVIANO CI", key, c, None, enc))

    # 3. Profil App Store dla tego certyfikatu — istniejący aktywny albo nowy.
    #    Nazwa zawiera numer seryjny certyfikatu, więc nowy certyfikat = nowy profil.
    name = f"{PROFILE_PREFIX} {c.serial_number:x}"[:50]
    prof = None
    for item in call("GET", f"/profiles?filter[name]={urllib.parse.quote(name)}&limit=50")["data"]:
        a = item["attributes"]
        if a["name"] == name and a.get("profileState") == "ACTIVE" and a.get("profileContent"):
            prof = item
            break
    if not prof:
        prof = call("POST", "/profiles", {"data": {
            "type": "profiles",
            "attributes": {"name": name, "profileType": "IOS_APP_STORE"},
            "relationships": {
                "bundleId": {"data": {"type": "bundleIds", "id": bundle["id"]}},
                "certificates": {"data": [{"type": "certificates", "id": cert["id"]}]},
            }}})["data"]
    with open(os.path.join(OUT, "profile.mobileprovision"), "wb") as f:
        f.write(base64.b64decode(prof["attributes"]["profileContent"]))

    # 4. Designated requirement z nazwą certyfikatu bajt w bajt (hex, bez normalizacji).
    cn = c.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
    with open(os.path.join(OUT, "dr.txt"), "w") as f:
        f.write(
            f'designated => identifier "{BUNDLE}" and anchor apple generic and '
            f"certificate leaf[subject.CN] = 0x{cn.encode('utf-8').hex()} and "
            "certificate 1[field.1.2.840.113635.100.6.2.1] /* exists */\n"
        )
    with open(os.path.join(OUT, "cert_sha1"), "w") as f:
        f.write(c.fingerprint(hashes.SHA1()).hex().upper())
    print(f"::notice::Certyfikat: {cn} · profil: {name}")


if __name__ == "__main__":
    main()
