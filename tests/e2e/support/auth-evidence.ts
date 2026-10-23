import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";

/** Explicit, local-only sanitized captures; never enable automatic auth artifacts. */
export async function captureAuthEvidence(page: Page, name: string) {
  if (process.env.QUILLA_CAPTURE_AUTH_VISUALS !== "1") return;
  if (!/^[a-z0-9-]+$/.test(name))
    throw new Error("Invalid visual evidence name");
  const directory = path.resolve("docs/auth/visuals");
  await mkdir(directory, { recursive: true });
  // Keyboard focus can scroll the page/body to the submit action. Capture the
  // complete shell from its start rather than retaining a cropped scroll view.
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    document.body.scrollTo(0, 0);
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((image) => image.complete && image.naturalWidth > 0)
        .map((image) => image.decode()),
    );
    // Let scroll-driven lazy-image/compositing updates paint before capture.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  // Redact every input's characters at capture time, including placeholders,
  // OTPs and password-reveal text. Preserve field outlines for useful visual QA.
  // Identity previews outside inputs receive opaque masks. Nothing is unmasked
  // in an intermediate saved image; Playwright removes these styles afterwards.
  await page.screenshot({
    path: path.join(directory, `${name}.png`),
    fullPage: true,
    animations: "disabled",
    style: `
      input, input::placeholder {
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
        caret-color: transparent !important;
        text-shadow: none !important;
      }
    `,
    maskColor: "#EFE4CA",
    mask: [page.getByText(/[^\s@]+@[^\s@]+\.[^\s@]+/)],
  });
}
