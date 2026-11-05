"""Render Family 02 source tables as exact-value PNG charts (Pillow only).

Run from the repository root. No questions, answer keys or datasets are changed.
After any changed rendering, inspect every image and update asset byte hashes,
reference/question versions as appropriate, and the reviewed manifest checksum.
"""

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BANK = ROOT / "content/question-bank/family-02"
FONT = Path("C:/Windows/Fonts/arial.ttf")
BOLD = Path("C:/Windows/Fonts/arialbd.ttf")
COLORS = ["#136F82", "#B35317", "#6654A2"]
INK = "#172D3B"
MUTED = "#445865"


def font(size, bold=False):
    candidate = BOLD if bold else FONT
    return ImageFont.truetype(str(candidate if candidate.exists() else "DejaVuSans.ttf"), size)


def label(draw, xy, text, size=26, fill=INK, anchor="la", bold=False):
    draw.text(xy, str(text), font=font(size, bold), fill=fill, anchor=anchor)


def panel(draw, rect, categories, series, names, unit, mode="grouped"):
    left, top, right, bottom = rect
    ymax = max(sum(values[i] for values in series) for i in range(len(categories))) if mode == "stacked" else max(max(v) for v in series)
    step = max(1, math.ceil(ymax / 5 / (10 ** max(0, len(str(int(ymax))) - 2)))) * (10 ** max(0, len(str(int(ymax))) - 2))
    ceiling = step * 6
    label(draw, (left, top - 65), unit, 27, bold=True)
    for tick in range(0, ceiling + 1, step):
        y = bottom - tick / ceiling * (bottom - top)
        draw.line((left, y, right, y), fill="#DCE4E8", width=2)
        label(draw, (left - 18, y), tick, 23, MUTED, "rm")
    draw.line((left, top, left, bottom, right, bottom), fill=INK, width=3)
    gap = (right - left) / len(categories)
    legend_y = top - 125
    legend_x = left
    for j, name in enumerate(names if len(names) > 1 else []):
        draw.rectangle((legend_x, legend_y - 13, legend_x + 28, legend_y + 13), fill=COLORS[j])
        label(draw, (legend_x + 40, legend_y), name, 25, anchor="lm")
        legend_x += draw.textlength(name, font=font(25)) + 100
    for i, category in enumerate(categories):
        cx = left + gap * (i + 0.5)
        label(draw, (cx, bottom + 32), category, 25, anchor="mt")
        if mode == "line":
            continue
        baseline = 0
        width = gap * 0.68 / (1 if mode == "stacked" else len(series))
        for j, values in enumerate(series):
            value = values[i]
            x0 = cx - gap * 0.34 + (0 if mode == "stacked" else j * width)
            y0 = bottom - (baseline + value) / ceiling * (bottom - top)
            y1 = bottom - baseline / ceiling * (bottom - top)
            draw.rectangle((x0, y0, x0 + width - (0 if mode == "stacked" else 8), y1 - 1), fill=COLORS[j])
            if mode == "stacked":
                label(draw, (cx, (y0 + y1) / 2), f"{value:g}", 25, "white", "mm", True)
                baseline += value
            else:
                text = f"{value:g}"
                label(draw, (x0 + (width - 8) / 2, y0 - 12), text, 24, anchor="mb", bold=True)
    if mode == "line":
        for j, values in enumerate(series):
            points = [(left + gap * (i + .5), bottom - v / ceiling * (bottom - top)) for i, v in enumerate(values)]
            draw.line(points, fill=COLORS[j], width=5)
            for (x, y), value in zip(points, values):
                if j == 0:
                    draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=COLORS[j])
                else:
                    draw.rectangle((x - 8, y - 8, x + 8, y + 8), fill=COLORS[j])
                label(draw, (x, y - 17 if j == 0 else y + 20), f"{value:g}", 24, anchor="mb" if j == 0 else "mt", bold=True)


def main():
    references = json.loads((BANK / "references/f02-supporting-material.json").read_text(encoding="utf-8"))
    assets = BANK / "references/assets"
    assets.mkdir(exist_ok=True)
    names = ["loans", "solar", "training", "stock", "ferry", "rainfall", "repairs", "donations", "calls", "produce"]
    modes = ["grouped", "line", "stacked", "grouped", "stacked", "panels", "grouped", "stacked", "stacked", "panels"]
    for index, (name, mode) in enumerate(zip(names, modes)):
        number = index * 4 + 1
        ref = next(r for r in references if r["referenceId"] == f"f02-data-english-{number:02d}-reference")
        table = next(b for b in ref["blocks"] if b["type"] == "table")
        for n in range(number, number + 4):
            other = next(r for r in references if r["referenceId"] == f"f02-data-english-{n:02d}-reference")
            assert next(b for b in other["blocks"] if b["type"] == "table") == table
        image = Image.new("RGB", (1600, 1120 if mode == "panels" else 960), "white")
        draw = ImageDraw.Draw(image)
        label(draw, (100, 65), table["caption"], 43, bold=True)
        label(draw, (100, 115), "Synthetic practice data | Family 02", 24, MUTED)
        categories = [r[0] for r in table["rows"]]
        series = [[float(r[j]) for r in table["rows"]] for j in range(1, len(table["headers"]))]
        if mode == "panels":
            units = ["Rainfall (mm)", "Rainy days (count)"] if name == "rainfall" else ["Crates (count)", "Mass per crate (kg)"]
            for j in range(2):
                panel(draw, (130, 300 + j * 395, 1500, 560 + j * 395), categories, [series[j]], [table["headers"][j + 1]], units[j])
        else:
            unit = "Energy (kWh)" if name == "solar" else "Passengers (count)" if name == "ferry" else "Items (count)" if name in ["stock", "donations"] else "Calls (count)" if name == "calls" else "Trainees (count)" if name == "training" else "Tickets (count)" if name == "repairs" else "Loans (count)"
            panel(draw, (130, 320, 1500, 810), categories, series, table["headers"][1:], unit, mode)
        label(draw, (100, image.height - 48), "Values are labelled directly. The accompanying table contains the same source values.", 22, MUTED)
        output = assets / f"f02-{name}.png"
        image.save(output, optimize=True)
        print(output.relative_to(ROOT))


if __name__ == "__main__":
    main()
