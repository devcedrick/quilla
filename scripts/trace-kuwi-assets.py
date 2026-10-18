from pathlib import Path

import vtracer


SOURCE_DIRECTORY = Path("docs/brand/sources")
OUTPUT_DIRECTORY = Path("public/brand/kuwi")

ASSETS = {
    "kuwi-hero-source.png": "kuwi-hero.svg",
    "kuwi-mark-source.png": "kuwi-mark.svg",
    "kuwi-mark-mono-source.png": "kuwi-mark-mono.svg",
    "kuwi-lockup-horizontal-source.png": "kuwi-lockup-horizontal.svg",
}

# This profile keeps full eight-bit color precision and disables curve
# simplification. The remaining thresholds reduce redundant paths while keeping
# the generated raster artwork at approximately 99% normalized pixel similarity.
CONFIG = vtracer.Config(
    filter_speckle=2,
    color_precision=8,
    layer_difference=32,
    corner_threshold=90,
    length_threshold=3.0,
    max_iterations=15,
    splice_threshold=35,
    simplify=None,
    path_precision=3,
    optimize=2,
)


def main() -> None:
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)

    for source_name, output_name in ASSETS.items():
        source = SOURCE_DIRECTORY / source_name
        output = OUTPUT_DIRECTORY / output_name
        CONFIG.convert_file(str(source), str(output))
        print(f"Traced {source} -> {output} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
