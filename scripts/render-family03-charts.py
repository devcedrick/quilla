"""Deterministic Family 03 charts from canonical reference tables; Pillow only."""

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BANK = ROOT / 'content/question-bank/family-03'
FONT = Path('C:/Windows/Fonts/arial.ttf')
BOLD = Path('C:/Windows/Fonts/arialbd.ttf')
COLORS = ['#176C85', '#A54A1D']


def font(size, bold=False):
    path = BOLD if bold else FONT
    return ImageFont.truetype(str(path if path.exists() else 'DejaVuSans.ttf'), size)


def render(reference):
    table = next(block for block in reference['blocks'] if block['type'] == 'table')
    image_block = next(block for block in reference['blocks'] if block['type'] == 'image')
    im = Image.new('RGB', (1600, 1000), '#FFFFFF')
    draw = ImageDraw.Draw(im)
    draw.text((70, 35), reference['title'], font=font(38, True), fill='#132D3C')
    subtitle = 'Synthetic practice data | Exact values labelled'
    if reference['referenceId'] not in ('f03-data-meter', 'f03-data-membership'):
        subtitle += ' | Separate scales per panel'
    draw.text((70, 92), subtitle, font=font(22), fill='#475966')
    target = BANK / 'references/assets' / (image_block['assetId'].removesuffix('-chart') + '.png')
    target.parent.mkdir(parents=True, exist_ok=True)
    if reference['referenceId'] == 'f03-data-meter':
        left, top, right, bottom = 180, 250, 1420, 800
        draw.text((70, 160), 'Cumulative reading (kWh)', font=font(27, True), fill=COLORS[0])
        maximum = 1400
        for tick in range(6):
            value = maximum * tick / 5
            y = bottom - (bottom - top) * value / maximum
            draw.line((left, y, right, y), fill='#D8E0E6', width=2)
            draw.text((left - 20, y), f'{value:g}', font=font(23), fill='#334955', anchor='rm')
        points = []
        for i, row in enumerate(table['rows']):
            x = left + i * (right - left) / 4
            y = bottom - float(row[1]) / maximum * (bottom - top)
            points.append((x, y))
            draw.text((x, bottom + 45), row[0], font=font(23), fill='#172D3C', anchor='mm')
            draw.text((x, y - 30), row[1], font=font(25, True), fill='#172D3C', anchor='mm')
        draw.line(points, fill=COLORS[0], width=6)
        for x, y in points:
            draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=COLORS[0])
        draw.text((70, 925), 'Readings at midnight at the start of each day; differences measure consumption.', font=font(24), fill='#334955')
        im.save(target)
        return target
    if reference['referenceId'] == 'f03-data-membership':
        palette = ['#176C85', '#A54A1D', '#6654A2', '#637B33']
        total = sum(float(row[1]) for row in table['rows'])
        angle = -90
        for i, row in enumerate(table['rows']):
            end = angle + float(row[1]) / total * 360
            draw.pieslice((100, 220, 760, 880), angle, end, fill=palette[i], outline='#FFFFFF', width=5)
            middle = math.radians((angle + end) / 2)
            x, y = 430 + 230 * math.cos(middle), 550 + 230 * math.sin(middle)
            draw.text((x, y), row[1], font=font(35, True), fill='#FFFFFF', anchor='mm')
            yy = 290 + 140 * i
            draw.rectangle((870, yy, 910, yy + 40), fill=palette[i])
            draw.text((940, yy + 20), row[0] + ' — ' + row[1] + ' staff', font=font(28), fill='#172D3C', anchor='lm')
            angle = end
        draw.text((70, 935), f'Total {total:g} staff. Categories are mutually exclusive and exhaustive.', font=font(25), fill='#334955')
        im.save(target)
        return target
    series_count = len(table['headers']) - 1
    width = 1460 / series_count
    for column in range(1, series_count + 1):
        left = 70 + (column - 1) * width
        right = left + width - 35
        title = table['headers'][column]
        draw.text((left, 160), title, font=font(27, True), fill=COLORS[column - 1])
        rows = table['rows']
        values = [float(row[column]) for row in rows]
        max_value = max(values)
        axis_max = math.ceil(max_value / 10) * 10
        chart_left = left + 160
        chart_right = right - 70
        top, bottom = 250, 790
        for tick in range(6):
            value = axis_max * tick / 5
            x = chart_left + (chart_right - chart_left) * tick / 5
            draw.line((x, top - 20, x, bottom + 35), fill='#D8E0E6', width=2)
            draw.text((x, bottom + 50), f'{value:g}', font=font(20), fill='#334955', anchor='mm')
        for i, (row, value) in enumerate(zip(rows, values)):
            y = top + (i + 0.5) * (bottom - top) / len(rows)
            draw.text((chart_left - 15, y), row[0], font=font(23), fill='#172D3C', anchor='rm')
            end = chart_left + (chart_right - chart_left) * value / axis_max
            draw.rectangle((chart_left, y - 23, end, y + 23), fill=COLORS[column - 1])
            draw.text((end + 12, y), row[column], font=font(24, True), fill='#172D3C', anchor='lm')
        draw.text((left, 925), 'Category: ' + table['headers'][0], font=font(23), fill='#334955')
    target = BANK / 'references/assets' / (image_block['assetId'].removesuffix('-chart') + '.png')
    target.parent.mkdir(parents=True, exist_ok=True)
    im.save(target)
    return target


if __name__ == '__main__':
    for record in json.loads((BANK / 'references/f03-data.json').read_text(encoding='utf-8')):
        print(render(record).relative_to(ROOT))
