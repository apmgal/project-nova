"""
Generates the Benefits Register artefact's two images (incomplete + complete),
mimicking the visual style of the existing pid_incomplete_v4.png /
pid_complete.png documents (torn-paper card on black, AstraZeneca wordmark,
black serif section headers, gray-shaded table). This is a scripted
approximation, not a hand-tuned illustration pass like the PID art (which saw
several manual v2->v3->v4 iterations) -- lower fidelity by design; revisit
with a proper illustration pass if this artefact earns one.

Run: python3 scripts/gen_benefits_register.py
Outputs to public/assets/documents/benefits_register_{incomplete,complete}.png
"""

import math
import random
from PIL import Image, ImageDraw, ImageFont

W, H = 1600, 1000
OUT_DIR = "public/assets/documents/"

SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
SANS_ITALIC = "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf"

CARD_BG = (250, 248, 243)
INK = (30, 28, 26)
GRAY_ROW = (231, 229, 224)
TBC_GRAY = (150, 146, 138)
AZ_PURPLE = (73, 47, 146)
AZ_GOLD = (223, 165, 42)
WARN = (150, 60, 30)
OK_GREEN = (40, 105, 60)


def font(path, size):
    return ImageFont.truetype(path, size)


def draw_az_wordmark(draw, x, y):
    draw.text((x, y), "AstraZeneca", font=font(SANS, 34), fill=AZ_PURPLE)
    # small solid accent dot, echoing the PID logo's colour pairing without
    # trying to reproduce the real AZ device mark closely
    cx, cy = x + 300, y + 14
    draw.ellipse([cx, cy - 10, cx + 20, cy + 10], fill=AZ_GOLD)


def wrap_text(draw, text, f, max_width):
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=f) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def torn_bottom_path(x0, y0, x1, y1, seed=7):
    rnd = random.Random(seed)
    pts = [(x0, y0), (x1, y0), (x1, y1)]
    n = 14
    for i in range(n, -1, -1):
        t = i / n
        px = x1 - t * (x1 - x0)
        jag = rnd.uniform(-14, 14)
        py = y1 + (10 if i % 2 == 0 else -6) + jag
        pts.append((px, py))
    pts.append((x0, y0))
    return pts


def base_card(rotated: bool):
    """Returns (canvas, draw, card_left, card_top, card_right, card_bottom)."""
    canvas = Image.new("RGB", (W, H), (0, 0, 0))
    if rotated:
        card_w, card_h = 900, 940
        card = Image.new("RGB", (card_w, card_h), CARD_BG)
        cdraw = ImageDraw.Draw(card)
        torn = torn_bottom_path(0, card_h - 130, card_w, card_h - 10, seed=11)
        cdraw.polygon(torn, fill=(0, 0, 0))
        # composite a subtle drop shadow, then rotate
        shadow = Image.new("RGBA", (card_w + 40, card_h + 40), (0, 0, 0, 0))
        sdraw = ImageDraw.Draw(shadow)
        sdraw.rectangle([20, 20, 20 + card_w, 20 + card_h], fill=(0, 0, 0, 160))
        shadow = shadow.rotate(-4, expand=True, resample=Image.BICUBIC)
        canvas.paste(shadow, (330, 60), shadow)
        card_rot = card.rotate(-4, expand=True, resample=Image.BICUBIC, fillcolor=(0, 0, 0))
        paste_x, paste_y = 300, 40
        canvas.paste(card_rot, (paste_x, paste_y))
        draw = ImageDraw.Draw(canvas)
        return canvas, draw, paste_x + 70, paste_y + 90, paste_x + 70 + card_w - 140, paste_y + card_h - 40
    else:
        card_l, card_t, card_r, card_b = 400, 90, 1180, 940
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sdraw = ImageDraw.Draw(shadow)
        sdraw.rectangle([card_l + 18, card_t + 18, card_r + 18, card_b + 18], fill=(0, 0, 0, 140))
        canvas.paste(Image.alpha_composite(canvas.convert("RGBA"), shadow).convert("RGB"), (0, 0))
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([card_l, card_t, card_r, card_b], fill=CARD_BG)
        return canvas, draw, card_l, card_t, card_r, card_b


BENEFITS = [
    {
        "text": "NHS Contract Secured",
        "measure": "Signed agreement",
        "evidence": "Procurement records",
        "owner": "Tomasz Nowak",
        "when": "Before launch (Week 24)",
    },
    {
        "text": "More Patients Treated",
        "measure": "Monthly production output",
        "evidence": "Manufacturing dashboard",
        "owner": "Priya Anand",
        "when": "After go-live",
    },
    {
        "text": "£12M Investment Justified",
        "measure": "ROI",
        "evidence": "Finance report",
        "owner": "Daniel Atwell",
        "when": "12 months after go-live",
    },
]


def render(complete: bool):
    canvas, draw, l, t, r, b = base_card(rotated=not complete)
    inner_w = r - l

    x = l + 40
    y = t + 10
    draw_az_wordmark(draw, x, y)
    y += 70

    draw.text((x, y), "Benefits Register", font=font(SERIF_BOLD, 46), fill=INK)
    y += 60
    draw.text((x, y), "Project Title: Project NOVA", font=font(SANS, 24), fill=INK)
    y += 30

    if not complete:
        # small in-fiction filename strip, echoing the dialogue's own
        # "Benefits_Plan_DRAFT_v3" reference
        y += 12
        draw.text(
            (x, y),
            "Benefits_Plan_DRAFT_v3.xlsx  —  last edited by E. Grant",
            font=font(SANS_ITALIC, 20),
            fill=TBC_GRAY,
        )
        y += 34
    else:
        y += 12
        draw.text(
            (x, y),
            "Status: APPROVED — signed off with D. Atwell, Act 3",
            font=font(SANS_BOLD, 20),
            fill=OK_GREEN,
        )
        y += 34

    y += 20
    draw.text((x, y), "1. Benefits", font=font(SERIF_BOLD, 30), fill=INK)
    y += 46

    usable_w = inner_w - 80
    col_benefit_w = int(usable_w * 0.26)
    col_measure_w = int(usable_w * 0.16)
    col_evidence_w = int(usable_w * 0.19)
    col_owner_w = int(usable_w * 0.15)
    col_when_w = usable_w - col_benefit_w - col_measure_w - col_evidence_w - col_owner_w

    headers = ["Benefit", "Measure", "Evidence", "Owner", "When"]
    col_widths = [col_benefit_w, col_measure_w, col_evidence_w, col_owner_w, col_when_w]
    col_x = [x]
    for w in col_widths[:-1]:
        col_x.append(col_x[-1] + w)

    header_font = font(SANS_BOLD, 19)
    for hx, htext, hw in zip(col_x, headers, col_widths):
        draw.text((hx, y), htext, font=header_font, fill=INK)
    y += 30
    draw.line([(x, y), (x + inner_w - 80, y)], fill=INK, width=2)
    y += 14

    body_font = font(SANS, 18)
    tbc_font = font(SANS_ITALIC, 18)
    line_h = 24
    row_pad = 22

    for i, benefit in enumerate(BENEFITS):
        row_top = y

        cells = (
            [benefit["measure"], benefit["evidence"], benefit["owner"], benefit["when"]]
            if complete
            else ["[Not yet defined]", "[Not yet defined]", "[TBC]", "[TBC]"]
        )
        cell_color = INK if complete else TBC_GRAY
        cell_font = body_font if complete else tbc_font

        # Wrap every cell in this row first so the row's height can be
        # sized to whichever cell needs the most lines — fixes a bug where
        # a narrow column (e.g. "Before launch (Week 24)" under "When")
        # would wrap to more lines than a fixed row height allowed for,
        # overlapping the row below it.
        name_lines = wrap_text(draw, benefit["text"], font(SANS_BOLD, 19), col_benefit_w - 14)
        cell_lines = [
            wrap_text(draw, ctext, cell_font, cwidth - 14)
            for cwidth, ctext in zip(col_widths[1:], cells)
        ]
        max_lines = max(len(name_lines), *(len(cl) for cl in cell_lines))
        row_h = max_lines * line_h + row_pad

        if i % 2 == 0:
            draw.rectangle([x - 10, row_top - 6, x + inner_w - 90, row_top + row_h - 10], fill=GRAY_ROW)

        ly = row_top
        for line in name_lines:
            draw.text((col_x[0], ly), line, font=font(SANS_BOLD, 19), fill=INK)
            ly += line_h

        for cx, clines in zip(col_x[1:], cell_lines):
            cy = row_top
            for line in clines:
                draw.text((cx, cy), line, font=cell_font, fill=cell_color)
                cy += line_h

        y = row_top + row_h

    y += 10
    draw.line([(x, y), (x + inner_w - 80, y)], fill=(200, 197, 190), width=1)
    y += 26

    if not complete:
        note = "Three benefits named — none say how anyone would prove it. Stops mid-sentence."
        for line in wrap_text(draw, note, font(SANS_ITALIC, 18), inner_w - 80):
            draw.text((x, y), line, font=font(SANS_ITALIC, 18), fill=TBC_GRAY)
            y += 24
    else:
        note = "Each benefit now has a defined Measure, Evidence source, and Owner."
        for line in wrap_text(draw, note, font(SANS_ITALIC, 18), inner_w - 80):
            draw.text((x, y), line, font=font(SANS_ITALIC, 18), fill=(90, 87, 80))
            y += 24

    return canvas


if __name__ == "__main__":
    incomplete = render(complete=False)
    incomplete.save(OUT_DIR + "benefits_register_incomplete.png")
    complete = render(complete=True)
    complete.save(OUT_DIR + "benefits_register_complete.png")
    print("Saved benefits_register_incomplete.png and benefits_register_complete.png")
