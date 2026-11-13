#!/usr/bin/env python3
"""Render captioned App Store screenshots from the Maestro marketing captures.

Run from anywhere: python3 store-assets/apple/screenshots/build.py
Writes <device>/NN-name.html and NN-name.png next to this file.
"""
import pathlib, subprocess

HERE = pathlib.Path(__file__).resolve().parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

SHOTS = [
    ("01-needs-you", "03-control-plane/01-all-machines-all-agents.png", "See which agent", "needs you."),
    ("02-answer", "03-control-plane/02-waiting-agent-work-mac.png", "Answer it", "from anywhere."),
    ("03-search", "02-agent-memory/07-hero.png", "Search every", "session you ran."),
    ("04-keeps-working", "01-start-anywhere-continue-anywhere/05-agent-resumed-remotely.png", "Reply, and it", "keeps working."),
    ("05-projects", "03-control-plane/07-hero.png", "Every machine.", "Every agent."),
]

# device: (canvas w, h, capture subdir, h1 size, h1 top, frame width, frame top, frame radius, border)
DEVICES = {
    "iphone": (1206, 2622, "", 108, 190, 960, 560, 120, 12),
    "ipad": (2064, 2752, "ipad/", 150, 200, 1500, 600, 70, 14),
}

TEMPLATE = """<!doctype html><meta charset=utf-8><style>
html,body{{margin:0;width:{w}px;height:{h}px;background:#0d1117;overflow:hidden;font-family:-apple-system,"SF Pro Display",sans-serif;color:#fff}}
.g{{position:absolute;inset:0;background:radial-gradient({gw}px {gh}px at 50% 30%,rgba(56,140,255,.22),transparent 70%)}}
h1{{position:absolute;top:{ht}px;left:80px;right:80px;margin:0;text-align:center;font-weight:700;font-size:{hs}px;line-height:1.05;letter-spacing:-.03em}}
h1 b{{color:#4aa3ff;font-weight:700}}
.p{{position:absolute;left:{fl}px;top:{ft}px;width:{fw}px;border-radius:{r}px;border:{b}px solid #2a3140;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.6)}}
.p img{{display:block;width:100%}}
</style>
<div class=g></div><h1>{l1}<br><b>{l2}</b></h1><div class=p><img src="{src}"></div>
"""

for device, (w, h, sub, hs, ht, fw, ft, r, b) in DEVICES.items():
    out = HERE / device
    out.mkdir(exist_ok=True)
    for name, capture, l1, l2 in SHOTS:
        src = f"../../../../artifacts/marketing/threadbase-maestro/{sub}{capture}"
        html = out / f"{name}.html"
        html.write_text(TEMPLATE.format(w=w, h=h, gw=w * 3 // 4, gh=w * 7 // 12, ht=ht, hs=hs,
                                        fl=(w - fw) // 2 - b, ft=ft, fw=fw, r=r, b=b, l1=l1, l2=l2, src=src))
        png = out / f"{name}.png"
        png.unlink(missing_ok=True)
        # Chrome can exit non-zero from its teardown watchdog after the file is written,
        # so success is judged by the file, not the exit code.
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        "--allow-file-access-from-files", f"--window-size={w},{h}",
                        "--force-device-scale-factor=1", f"--screenshot={png}", html.as_uri()],
                       capture_output=True)
        if not png.exists():
            raise SystemExit(f"render failed: {png}")
        # App Store Connect rejects alpha; flatten to RGB.
        subprocess.run(["sips", "-s", "format", "jpeg", str(png), "--out", f"{png}.jpg"], check=True, capture_output=True)
        subprocess.run(["sips", "-s", "format", "png", f"{png}.jpg", "--out", str(png)], check=True, capture_output=True)
        pathlib.Path(f"{png}.jpg").unlink()
        print(png.relative_to(HERE))
