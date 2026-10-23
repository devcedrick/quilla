import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// Native image-mesh deformation, not clipped duplicate limbs or DOM animation.
// Coordinates refer to the unchanged, approved 1368 × 1150 transparent source.
export const dimensions = { width: 1368, height: 1150 };
const smooth = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const band = (value, outerStart, innerStart, innerEnd, outerEnd) =>
  smooth((value - outerStart) / (innerStart - outerStart)) *
  smooth((outerEnd - value) / (outerEnd - innerEnd));

export function wavePoint(x, y, angle) {
  // Above the shoulder keep the head still, but lower the gate toward the
  // transparent gap as x moves away from it. A horizontal gate at y=510 cut
  // through the upper feather: its lower vertices overtook its stationary tip,
  // inverting triangles and making the wing look clipped at the wave's peak.
  const upperGate = 510 - 160 * smooth((x - 980) / 90);
  const weight =
    smooth((x - 900) / 170) *
    smooth((y - upperGate) / 160) *
    smooth((980 - y) / 165);
  const dx = x - 915;
  const dy = y - 620;
  return [
    x + weight * (dx * Math.cos(angle) - dy * Math.sin(angle) - dx),
    y + weight * (dx * Math.sin(angle) + dy * Math.cos(angle) - dy),
  ];
}

export function blinkY(x, y) {
  let result = y;
  for (const eye of [
    { x: [628, 640, 760, 780], y: [365, 374, 501, 530] },
    { x: [864, 874, 930, 944], y: [296, 306, 426, 445] },
  ]) {
    const [top, irisTop, irisBottom, bottom] = eye.y;
    if (y <= top || y >= bottom) continue;
    const closedTop = irisBottom - 6;
    const closedBottom = irisBottom;
    // A monotonic map prevents inverted triangles at the lid boundary.
    const mapped =
      y < irisTop
        ? top + ((y - top) / (irisTop - top)) * (closedTop - top)
        : y > irisBottom
          ? closedBottom +
            ((y - irisBottom) / (bottom - irisBottom)) * (bottom - closedBottom)
          : closedTop +
            ((y - irisTop) / (irisBottom - irisTop)) *
              (closedBottom - closedTop);
    result += (mapped - y) * band(x, ...eye.x);
  }
  return result;
}

const number = (value) => Number(value.toFixed(5));
function keyframes(property, frames) {
  return `<KeyedProperty property="${property}">${frames
    .map(
      ([frame, value], index) =>
        `<KeyFrameDouble frame="${frame}" value="${number(value)}" interpolationType="${index === frames.length - 1 ? "hold" : "cubic"}">${index === frames.length - 1 ? "" : '<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>'}</KeyFrameDouble>`,
    )
    .join("")}</KeyedProperty>`;
}

export function createScene() {
  const xs = [0];
  for (let x = 40; x < 1368; x += x >= 600 && x < 970 ? 10 : 40) xs.push(x);
  xs.push(1368);
  xs.push(628, 640, 760, 780, 864, 874, 930, 944);
  xs.sort((a, b) => a - b);
  for (let i = xs.length - 1; i > 0; i--)
    if (xs[i] === xs[i - 1]) xs.splice(i, 1);
  const ys = [0];
  for (let y = 30; y < 1150; y += y >= 270 && y < 550 ? 10 : 30) ys.push(y);
  ys.push(1150);
  ys.push(365, 374, 501, 296, 306, 426, 445);
  ys.sort((a, b) => a - b);
  const grid = ys.flatMap((y, row) => xs.map((x, col) => ({ x, y, row, col })));
  // Rive's editor expects a clockwise leading contour, then interior vertices.
  const boundary = [
    ...grid.filter((p) => p.row === 0),
    ...grid.filter((p) => p.col === xs.length - 1 && p.row > 0),
    ...grid
      .filter((p) => p.row === ys.length - 1 && p.col < xs.length - 1)
      .reverse(),
    ...grid
      .filter((p) => p.col === 0 && p.row > 0 && p.row < ys.length - 1)
      .reverse(),
  ];
  const vertices = [
    ...boundary,
    ...grid.filter(
      (p) =>
        p.col > 0 &&
        p.col < xs.length - 1 &&
        p.row > 0 &&
        p.row < ys.length - 1,
    ),
  ];
  const indices = new Map(
    vertices.map((p, index) => [`${p.row}:${p.col}`, index]),
  );
  const triangles = [];
  for (let row = 0; row < ys.length - 1; row++) {
    for (let col = 0; col < xs.length - 1; col++) {
      const a = indices.get(`${row}:${col}`);
      const b = indices.get(`${row}:${col + 1}`);
      const c = indices.get(`${row + 1}:${col + 1}`);
      const d = indices.get(`${row + 1}:${col}`);
      triangles.push(a, b, c, a, c, d);
    }
  }
  const bytes = [];
  for (let index of triangles) {
    while (index >= 128) {
      bytes.push((index & 127) | 128);
      index >>>= 7;
    }
    bytes.push(index);
  }
  const mesh = vertices
    .map((p, index) => {
      const type = index < boundary.length ? "ContourMeshVertex" : "MeshVertex";
      return `<${type} id="0:${100 + index}" name="Point ${p.col}-${p.row}" x="${p.x - 684}" y="${p.y - 575}" u="${number(p.x / 1368)}" v="${number(p.y / 1150)}"/>`;
    })
    .join("\n");
  const waveFrames = [
    [0, 0],
    [28, 0],
    [44, -0.19],
    [57, 0.045],
    [70, -0.16],
    [86, 0],
    [192, 0],
    [220, 0],
    [236, -0.19],
    [249, 0.045],
    [262, -0.16],
    [278, 0],
    [384, 0],
  ];
  const keyed = vertices
    .flatMap((p, index) => {
      const wave = wavePoint(p.x, p.y, -0.19);
      const blink = blinkY(p.x, p.y);
      const waving = Math.abs(wave[0] - p.x) + Math.abs(wave[1] - p.y) > 0.001;
      const blinking = Math.abs(blink - p.y) > 0.001;
      if (!waving && !blinking) return [];
      const properties = [];
      if (waving) {
        for (const [axis, property, center] of [
          [0, "x", 684],
          [1, "y", 575],
        ])
          properties.push(
            keyframes(
              property,
              waveFrames.map(([frame, angle]) => [
                frame,
                wavePoint(p.x, p.y, angle)[axis] - center,
              ]),
            ),
          );
      } else if (blinking) {
        properties.push(
          keyframes("y", [
            [0, p.y - 575],
            [153, p.y - 575],
            [159, blink - 575],
            [162, blink - 575],
            [170, p.y - 575],
            [384, p.y - 575],
          ]),
        );
      }
      return [
        `<KeyedObject objectId="0:${100 + index}">${properties.join("")}</KeyedObject>`,
      ];
    })
    .join("\n");
  return `<Rive version="1" kind="fragment">
  <!-- Generated by scripts/kuwi-rive-scene.mjs. Edit that source, then regenerate. -->
  <Artboard defaultStateMachineId="0:7" styleId="0:5" width="1368" height="1150" name="Kuwi Auth" id="0:2">
    <LayoutComponentStyle name="Artboard Style" id="0:5"/>
    <Image x="684" y="575" assetId="0:20" name="Approved Kuwi pose">
      <Mesh triangleIndexBytes="${Buffer.from(bytes).toString("base64")}" name="Kuwi character mesh">${mesh}</Mesh>
    </Image>
    <StateMachine name="AccountIdle" id="0:7">
      <StateMachineLayer name="Character actions" id="0:8">
        <AnyState x="200" y="-120"/><ExitState x="400" y="-120"/>
        <EntryState><StateTransition stateToId="0:12"/></EntryState>
        <AnimationState x="200" animationId="0:6" id="0:12"/>
      </StateMachineLayer>
    </StateMachine>
    <LinearAnimation fps="60" duration="384" loopValue="loop" name="Welcome wave and blink" id="0:6">${keyed}</LinearAnimation>
  </Artboard>
  <ImageAsset file="../../../docs/brand/sources/kuwi-auth-welcome-source.png" name="Approved Kuwi pose" id="0:20"/>
</Rive>\n`;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  writeFileSync(
    fileURLToPath(
      new URL("../assets/rive/kuwi-auth/scene.rml", import.meta.url),
    ),
    createScene(),
  );
}
