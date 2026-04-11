"""
connection_check.py
-------------------
Utility script to verify all external service connections
required by the Flask app before starting the server.

Checks:
  1. Environment variables (.env)
  2. Firebase Firestore
  3. Gemini AI API
  4. Auto-scraper module import
  5. Optional: network reachability to a test URL

Usage:
  python connection_check.py
  python connection_check.py --verbose
"""

import os
import sys
import json
import time
import argparse
import logging

# ── Warna terminal ──────────────────────────────────────────────────────────
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

OK   = f"{GREEN}[  OK  ]{RESET}"
WARN = f"{YELLOW}[ WARN ]{RESET}"
FAIL = f"{RED}[ FAIL ]{RESET}"
INFO = f"{CYAN}[ INFO ]{RESET}"

logging.basicConfig(level=logging.WARNING)  # suppress noisy lib logs by default

results: list[dict] = []


def _record(name: str, status: str, detail: str = ""):
    """Store result for final summary."""
    results.append({"name": name, "status": status, "detail": detail})


def _print(icon: str, label: str, detail: str = ""):
    msg = f"  {icon}  {BOLD}{label}{RESET}"
    if detail:
        msg += f"  →  {detail}"
    print(msg)


# ── 1. Environment Variables ────────────────────────────────────────────────
def check_env(verbose: bool):
    print(f"\n{BOLD}[1] Environment Variables{RESET}")
    from dotenv import load_dotenv
    load_dotenv()

    required = {
        "GEMINI_API_KEY":      "Gemini AI calls",
        "ADMIN_SECRET_TOKEN":  "Admin endpoints (optional, has default)",
    }
    optional = {
        "GEMINI_MODEL":        "gemini-2.5-flash",
        "FIREBASE_KEY_PATH":   "firebase-key.json (default)",
    }

    all_ok = True
    for key, purpose in required.items():
        val = os.getenv(key)
        if val:
            masked = val[:4] + "*" * max(0, len(val) - 8) + val[-4:] if len(val) > 8 else "****"
            _print(OK, key, f"set ({masked})  —  {purpose}")
            _record(key, "ok", purpose)
        else:
            _print(FAIL, key, f"NOT SET  —  needed for: {purpose}")
            _record(key, "fail", f"Missing: {purpose}")
            all_ok = False

    if verbose:
        for key, default in optional.items():
            val = os.getenv(key, default)
            _print(INFO, key, f"{val}  (optional)")

    return all_ok


# ── 2. Firebase Firestore ───────────────────────────────────────────────────
def check_firebase(verbose: bool):
    print(f"\n{BOLD}[2] Firebase Firestore{RESET}")
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        key_path = os.getenv("FIREBASE_KEY_PATH", "firebase-key.json")
        if not os.path.exists(key_path):
            _print(FAIL, "Firebase key file", f"'{key_path}' not found")
            _record("Firebase", "fail", f"Key file missing: {key_path}")
            return False

        if not firebase_admin._apps:
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred)

        db = firestore.client()

        # Lightweight probe: list collections
        t0 = time.time()
        cols = list(db.collections())
        elapsed = round((time.time() - t0) * 1000)

        col_names = [c.id for c in cols[:5]]
        _print(OK, "Firebase Firestore", f"connected in {elapsed} ms  |  collections: {col_names or '(none)'}")
        _record("Firebase", "ok", f"{elapsed} ms")

        # FAQ collection check
        faq_docs = list(db.collection("faq").limit(3).stream())
        if faq_docs:
            _print(OK, "FAQ collection", f"{len(faq_docs)} sample doc(s) found")
            if verbose:
                for doc in faq_docs:
                    d = doc.to_dict()
                    _print(INFO, f"  faq/{doc.id}", f"q={str(d.get('q',''))[:60]}…")
        else:
            _print(WARN, "FAQ collection", "exists but is empty — bot will have no knowledge base")
            _record("FAQ collection", "warn", "empty")

        return True

    except ImportError:
        _print(FAIL, "firebase_admin", "package not installed  →  pip install firebase-admin")
        _record("Firebase", "fail", "ImportError")
        return False
    except Exception as e:
        _print(FAIL, "Firebase", str(e))
        _record("Firebase", "fail", str(e))
        return False


# ── 3. Gemini AI API ────────────────────────────────────────────────────────
def check_gemini(verbose: bool):
    print(f"\n{BOLD}[3] Gemini AI API{RESET}")
    api_key = os.getenv("GEMINI_API_KEY")
    model   = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    if not api_key:
        _print(FAIL, "Gemini", "GEMINI_API_KEY not set — skipping API test")
        _record("Gemini", "skip", "No API key")
        return False

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        t0 = time.time()
        response = client.models.generate_content(
            model=model,
            contents="Reply with exactly the word: PONG",
            config=types.GenerateContentConfig(
                temperature=0,
                max_output_tokens=10,
            )
        )
        elapsed = round((time.time() - t0) * 1000)
        reply = (response.text or "").strip()

        if "PONG" in reply.upper():
            _print(OK, f"Gemini ({model})", f"round-trip {elapsed} ms  |  response: '{reply}'")
            _record("Gemini", "ok", f"{elapsed} ms")
            return True
        else:
            _print(WARN, f"Gemini ({model})", f"unexpected reply: '{reply[:80]}'  ({elapsed} ms)")
            _record("Gemini", "warn", f"Unexpected reply: {reply[:80]}")
            return True  # API itself reachable

    except ImportError:
        _print(FAIL, "google-genai", "package not installed  →  pip install google-genai")
        _record("Gemini", "fail", "ImportError")
        return False
    except Exception as e:
        _print(FAIL, "Gemini", str(e))
        _record("Gemini", "fail", str(e))
        return False


# ── 4. Auto-scraper module ──────────────────────────────────────────────────
def check_auto_scraper(verbose: bool):
    print(f"\n{BOLD}[4] Auto-scraper Module{RESET}")
    try:
        from auto_scraper import scrape_url  # noqa: F401
        _print(OK, "auto_scraper", "module imported successfully")
        _record("auto_scraper", "ok")
        return True
    except ImportError as e:
        _print(FAIL, "auto_scraper", f"Cannot import  →  {e}")
        _record("auto_scraper", "fail", str(e))
        return False
    except Exception as e:
        _print(FAIL, "auto_scraper", str(e))
        _record("auto_scraper", "fail", str(e))
        return False


# ── 5. Network / HTTP reachability ──────────────────────────────────────────
def check_network(verbose: bool):
    print(f"\n{BOLD}[5] Network Reachability{RESET}")
    import urllib.request

    test_urls = [
        ("Google",          "https://www.google.com"),
        ("Gemini API host", "https://generativelanguage.googleapis.com"),
    ]

    all_ok = True
    for label, url in test_urls:
        try:
            t0 = time.time()
            req = urllib.request.Request(url, headers={"User-Agent": "connection_check/1.0"})
            with urllib.request.urlopen(req, timeout=5) as r:
                code    = r.getcode()
                elapsed = round((time.time() - t0) * 1000)
            _print(OK, label, f"HTTP {code}  ({elapsed} ms)  —  {url}")
            _record(f"Network:{label}", "ok", f"HTTP {code}")
        except Exception as e:
            _print(FAIL, label, f"{url}  →  {e}")
            _record(f"Network:{label}", "fail", str(e))
            all_ok = False

    return all_ok


# ── 6. Python packages ──────────────────────────────────────────────────────
def check_packages(verbose: bool):
    print(f"\n{BOLD}[6] Required Python Packages{RESET}")
    packages = [
        ("flask",           "Flask"),
        ("flask_cors",      "Flask-CORS"),
        ("flask_limiter",   "Flask-Limiter"),
        ("dotenv",          "python-dotenv"),
        ("bs4",             "BeautifulSoup4"),
        ("requests",        "requests"),
        ("firebase_admin",  "firebase-admin"),
        ("google.genai",    "google-genai"),
    ]

    all_ok = True
    for module, pip_name in packages:
        try:
            __import__(module)
            _print(OK, pip_name)
            _record(f"pkg:{pip_name}", "ok")
        except ImportError:
            _print(FAIL, pip_name, f"pip install {pip_name}")
            _record(f"pkg:{pip_name}", "fail", "not installed")
            all_ok = False

    return all_ok


# ── Summary ─────────────────────────────────────────────────────────────────
def print_summary():
    print(f"\n{'='*55}")
    print(f"{BOLD}  CONNECTION CHECK SUMMARY{RESET}")
    print(f"{'='*55}")

    fails = [r for r in results if r["status"] == "fail"]
    warns = [r for r in results if r["status"] == "warn"]
    oks   = [r for r in results if r["status"] == "ok"]

    print(f"  {GREEN}Passed : {len(oks)}{RESET}")
    print(f"  {YELLOW}Warnings: {len(warns)}{RESET}")
    print(f"  {RED}Failed : {len(fails)}{RESET}")

    if warns:
        print(f"\n{YELLOW}  Warnings:{RESET}")
        for r in warns:
            print(f"    • {r['name']}: {r['detail']}")

    if fails:
        print(f"\n{RED}  Failures:{RESET}")
        for r in fails:
            print(f"    • {r['name']}: {r['detail']}")
        print(f"\n{RED}  ⚠  Fix the above issues before starting the server.{RESET}")
    else:
        print(f"\n{GREEN}  ✅  All critical checks passed — app is ready to start!{RESET}")

    print(f"{'='*55}\n")
    return len(fails) == 0


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Pre-flight connection checker for the UPJ chatbot backend.")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show extra detail")
    parser.add_argument("--skip-network", action="store_true", help="Skip network reachability test")
    args = parser.parse_args()

    print(f"\n{BOLD}{CYAN}  UPJ Chatbot — Connection Checker{RESET}")
    print(f"  {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

    check_packages(args.verbose)
    check_env(args.verbose)
    check_firebase(args.verbose)
    check_gemini(args.verbose)
    check_auto_scraper(args.verbose)

    if not args.skip_network:
        check_network(args.verbose)

    all_passed = print_summary()
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()