"""Regression checks for learner-facing chart labels; requires Pillow."""

import importlib.util
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import patch

from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location(
    "family02_charts", Path(__file__).with_name("render-family02-charts.py")
)
CHARTS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHARTS)


class PlainLabels(unittest.TestCase):
    def render_labels(self, mode, categories=None):
        texts = []
        image = Image.new("RGB", (1600, 960), "white")
        with patch.object(CHARTS, "label", side_effect=lambda _d, _xy, text, *a, **kw: texts.append(str(text))), patch.object(CHARTS, "font", return_value=ImageFont.load_default()):
            CHARTS.panel(
                ImageDraw.Draw(image), (130, 320, 1500, 810),
                categories or ["A", "B"], [[37, 53], [19, 29]],
                ["Intake", "Processed"], "Items (count)", mode,
            )
        return texts

    def test_plain_values_and_named_legends_in_every_chart_mode(self):
        for mode in ["grouped", "stacked", "line"]:
            with self.subTest(mode=mode):
                texts = self.render_labels(mode)
                for value in ["37", "53", "19", "29"]:
                    self.assertIn(value, texts)
                self.assertIn("Intake", texts)
                self.assertIn("Processed", texts)
                self.assertFalse(any(re.search(r"\d+\s*:\s*\d+", text) for text in texts))
                self.assertFalse(any(re.match(r"\d+\.\s", text) for text in texts))

    def test_real_time_categories_are_preserved(self):
        # Removing series indicators must not strip meaningful colons in times.
        texts = self.render_labels("stacked", ["08:00", "10:00"])
        self.assertIn("08:00", texts)
        self.assertIn("10:00", texts)
        self.assertNotIn("1: 37", texts)


if __name__ == "__main__":
    unittest.main()
