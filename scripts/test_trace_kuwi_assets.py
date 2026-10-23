"""Run with pinned VTracer: python -B -m unittest discover -s scripts."""

import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location(
    "trace_kuwi", Path(__file__).with_name("trace-kuwi-assets.py")
)
trace = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trace)


class AssetSelectionTests(unittest.TestCase):
    def run_trace(self, args):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output"
            config = Mock()
            config.convert_file.side_effect = lambda _source, dest: Path(dest).write_text(
                "<svg/>"
            )
            with (
                patch.object(trace, "OUTPUT_DIRECTORY", output),
                patch.object(trace, "CONFIG", config),
                patch("sys.argv", ["trace-kuwi-assets.py", *args]),
                contextlib.redirect_stdout(io.StringIO()),
                contextlib.redirect_stderr(io.StringIO()),
            ):
                trace.main()
            return [
                Path(call.args[1]).name for call in config.convert_file.call_args_list
            ]

    def test_targeted_trace_does_not_rewrite_existing_assets(self):
        self.assertEqual(
            self.run_trace(["--asset", "kuwi-auth-welcome-source.png"]),
            ["kuwi-auth-welcome.svg"],
        )

    def test_default_retains_trace_all_behavior(self):
        self.assertEqual(self.run_trace([]), list(trace.ASSETS.values()))

    def test_unknown_asset_is_rejected(self):
        with self.assertRaises(SystemExit) as failure:
            self.run_trace(["--asset", "unknown.png"])
        self.assertEqual(failure.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
