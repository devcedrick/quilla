import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertInspection, assertSafeArchiveEntries } from "./rive-tools.mjs";
import { blinkY, createScene, wavePoint } from "./kuwi-rive-scene.mjs";

describe("Rive authoring safeguards", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  it("ships the approved pose in a real Rive file", () => {
    const riv = readFileSync(
      path.join(root, "public/brand/kuwi/rive/kuwi-auth.riv"),
    );
    const source = readFileSync(
      path.join(root, "docs/brand/sources/kuwi-auth-welcome-source.png"),
    );
    expect(riv.subarray(0, 4).toString()).toBe("RIVE");
    expect(riv.includes(source)).toBe(true);
  });
  it("ships WASM bytes matching the pinned installed runtime", () => {
    const runtime = path.dirname(
      fileURLToPath(import.meta.resolve("@rive-app/canvas")),
    );
    for (const [source, output] of [
      ["rive.wasm", "runtime-2.45.1.wasm"],
      ["rive_fallback.wasm", "runtime-2.45.1-fallback.wasm"],
    ]) {
      const shipped = readFileSync(
        path.join(root, "public/brand/kuwi/rive", output),
      );
      expect(shipped.equals(readFileSync(path.join(runtime, source)))).toBe(
        true,
      );
      expect([...shipped.subarray(0, 4)]).toEqual([0, 97, 115, 109]);
    }
  });
  it("accepts only the expected safe archive trees", () => {
    expect(() =>
      assertSafeArchiveEntries(
        "rive.exe\ndocs/assets.md\nsamples/basic/scene.rml\n",
      ),
    ).not.toThrow();
  });
  it.each([
    "../rive.exe",
    "/rive.exe",
    "C:rive.exe",
    "docs/../../file",
    "docs\\file",
    "unexpected.exe",
  ])("rejects unsafe archive entry %s", (entry) => {
    expect(() => assertSafeArchiveEntries(entry)).toThrow();
  });
  const valid = () => ({
    problems: [],
    roots: [{ type: "ImageAsset" }],
    artboards: [
      {
        name: "Kuwi Auth",
        width: 1368,
        height: 1150,
        children: [
          { type: "StateMachine", name: "AccountIdle" },
          {
            type: "Image",
            children: [
              {
                type: "Mesh",
                rig: { triangles: [[0, 1, 2]] },
                children: [{ type: "MeshVertex", id: "0:100" }],
              },
            ],
          },
          {
            type: "LinearAnimation",
            name: "Welcome wave and blink",
            fps: 60,
            duration: 384,
            enums: { loopValue: "loop" },
            children: [
              {
                type: "KeyedObject",
                objectId: "0:100",
                children: [
                  {
                    propertyKey: 25,
                    children: [
                      { frame: 0, value: 0 },
                      { frame: 159, value: 5 },
                      { frame: 384, value: 0 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  it("accepts the script-free approved-pose contract", () => {
    expect(() => assertInspection(valid())).not.toThrow();
  });
  it("rejects the previous still-pose export", () => {
    const still = valid();
    still.artboards[0].children = still.artboards[0].children.filter(
      (item) => item.type !== "LinearAnimation",
    );
    expect(() => assertInspection(still)).toThrow(/native Kuwi mesh animation/);
  });
  it("rejects whole-image motion and broken loop seams", () => {
    const wholeImage = valid();
    wholeImage.artboards[0].children[2].children[0].objectId = "0:999";
    expect(() => assertInspection(wholeImage)).toThrow(/mesh vertices/);
    const seam = valid();
    seam.artboards[0].children[2].children[0].children[0].children[2].value = 8;
    expect(() => assertInspection(seam)).toThrow(/resting pose/);
  });
  it("reproduces the committed native scene exactly", () => {
    expect(createScene()).toBe(
      readFileSync(path.join(root, "assets/rive/kuwi-auth/scene.rml"), "utf8"),
    );
  });
  it("anchors the feet, body, head and Q-tail while waving the wing", () => {
    for (const point of [
      [600, 1100],
      [930, 1080],
      [700, 800],
      [400, 760],
      [900, 400],
    ]) {
      expect(wavePoint(...point, -0.19)).toEqual(point);
    }
    expect(wavePoint(1200, 620, -0.19)[1]).toBeLessThan(620);
    expect(wavePoint(1200, 620, 0)).toEqual([1200, 620]);
  });
  it("closes only the eye regions without folding their vertical mesh", () => {
    expect(blinkY(700, 400)).toBeGreaterThan(400);
    expect(blinkY(900, 350)).toBeGreaterThan(350);
    for (const [x, y] of [
      [700, 200],
      [850, 470],
      [700, 800],
      [300, 800],
    ])
      expect(blinkY(x, y)).toBe(y);
    for (const x of [635, 700, 770, 870, 900, 940]) {
      for (let y = 260; y < 550; y++)
        expect(blinkY(x, y + 1)).toBeGreaterThan(blinkY(x, y));
    }
  });
  it("keeps wing triangles facing forward throughout the wave", () => {
    // Regression: the old y=510 gate made lower feather vertices overtake
    // the tip and flipped triangles at peak lift (e.g. x=1200, y=530).
    for (const angle of [-0.19, -0.16, 0.045]) {
      for (let x = 900; x < 1368; x += 10) {
        for (let y = 300; y < 980; y += 10) {
          const a = wavePoint(x, y, angle);
          const b = wavePoint(x + 10, y, angle);
          const c = wavePoint(x, y + 10, angle);
          const area =
            (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
          expect(area).toBeGreaterThan(0);
        }
      }
    }
  });
  it("rejects wrong artboards, missing state machines, problems and scripts", () => {
    const wrongSize = valid();
    wrongSize.artboards[0].width = 1;
    const missingMachine = valid();
    missingMachine.artboards[0].children = [{ type: "Image" }];
    const problems = valid();
    problems.problems.push({ message: "failed" });
    const scripts = valid();
    scripts.roots.push({ type: "ScriptAsset" });
    for (const report of [wrongSize, missingMachine, problems, scripts])
      expect(() => assertInspection(report)).toThrow();
  });
});
