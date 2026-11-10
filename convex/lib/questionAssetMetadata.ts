import type { Infer } from "convex/values";
import {
  positive,
  provenance,
  text,
  validateProvenance,
} from "./questionContent";
import { questionWorkflowError as fail } from "./questionWorkflow";

export type AssetMetadataInput = {
  assetId: string;
  sha256: string;
  width: number;
  height: number;
  provenance: Infer<typeof provenance>;
};

/** Validate a portable asset identifier used by metadata and reference images. */
export function validateAssetId(value: string) {
  text(value);
  if (value.length > 100) fail("VALIDATION_FAILED");
}
/** Validate immutable image metadata identically for authoring and import preflight. */
export function validateAssetMetadata(args: AssetMetadataInput) {
  validateAssetId(args.assetId);
  positive(args.width);
  positive(args.height);
  validateProvenance(args.provenance);
  if (!/^[a-f0-9]{64}$/.test(args.sha256)) fail("VALIDATION_FAILED");
}
