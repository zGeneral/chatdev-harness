#!/usr/bin/env python3
"""Generate an image from a text prompt with a Google Gemini image model.

Self-contained (stdlib only). Reads the API key from the GEMINI_API_KEY environment
variable so the repo stays free of secrets — see .env.example. Saves <basename>.png
(+ a sibling <basename>.txt with the prompt) to --output-dir and prints the PNG path.

Usage:
  GEMINI_API_KEY=... python tools/genimage.py \\
    --prompt "a neon cyan ship dodging grey rocks, flat-vector, portrait" \\
    --model gemini-2.5-flash-image --output-dir ./artdemo --name hero
"""
import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def slugify(text: str, maxlen: int = 50) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()[:maxlen]


def extract_image_b64(resp_json: dict):
    for cand in resp_json.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                return inline["data"]
    return None


def main() -> int:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        sys.stderr.write(
            "GEMINI_API_KEY is not set. Get a key from https://aistudio.google.com/apikey "
            "and export it (or add it to .env — see .env.example).\n"
        )
        return 2

    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", required=True, help="Text prompt for the image")
    ap.add_argument("--model", default="gemini-2.5-flash-image", help="Gemini image model id")
    ap.add_argument("--output-dir", default=".", help="Where to save the .png + .txt")
    ap.add_argument("--name", default=None, help="Basename (no extension); default <timestamp>_<slug>")
    args = ap.parse_args()

    req = urllib.request.Request(
        ENDPOINT.format(model=args.model),
        data=json.dumps({"contents": [{"parts": [{"text": args.prompt}]}]}).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"HTTP {e.code} from Gemini API:\n{e.read().decode('utf-8', 'replace')}\n")
        return 1
    except urllib.error.URLError as e:
        sys.stderr.write(f"Network error: {e}\n")
        return 1

    img_b64 = extract_image_b64(data)
    if not img_b64:
        sys.stderr.write("No image data in response (the model may have refused). Raw (truncated):\n")
        sys.stderr.write(json.dumps(data, indent=2)[:2000] + "\n")
        return 1

    out_dir = Path(args.output_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.name:
        basename = re.sub(r'[/\\:*?"<>|]', "", args.name).strip() or datetime.now().strftime("%Y%m%d-%H%M%S")
    else:
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        slug = slugify(args.prompt)
        basename = f"{ts}_{slug}" if slug else ts

    img_path = out_dir / f"{basename}.png"
    img_path.write_bytes(base64.b64decode(img_b64))
    (out_dir / f"{basename}.txt").write_text(
        f"Model: {args.model}\nGenerated: {datetime.now().isoformat(timespec='seconds')}\n\nPrompt:\n{args.prompt}\n",
        encoding="utf-8",
    )
    print(str(img_path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
