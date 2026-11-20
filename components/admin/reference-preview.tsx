"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AdminLoading } from "./admin-ui";

export function ReferencePreview({
  referenceVersionId,
}: {
  referenceVersionId: Id<"questionReferenceVersions"> | "";
}) {
  const preview = useQuery(
    api.questionReferences.getAdminPreview,
    referenceVersionId ? { referenceVersionId } : "skip",
  );
  if (!referenceVersionId) return null;
  if (preview === undefined)
    return <AdminLoading>Loading the immutable reference…</AdminLoading>;
  if (preview === null)
    return (
      <p role="alert" className="text-sm text-destructive">
        This reference version is unavailable.
      </p>
    );
  const assets = new Map(
    preview.assets.map((asset) => [String(asset.assetId), asset]),
  );
  return (
    <section
      aria-labelledby="reference-preview-title"
      className="space-y-4 rounded-2xl border border-border bg-background p-5"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
          Shared reference
        </p>
        <h2
          id="reference-preview-title"
          className="mt-1 font-heading text-xl font-semibold"
        >
          {preview.reference.content.title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {preview.reference.referenceId} · version {preview.reference.version}{" "}
          · {preview.reference.content.language}
        </p>
      </div>
      {preview.reference.content.blocks.map((block, index) => {
        if (block.type === "text")
          return (
            <p
              key={index}
              className="whitespace-pre-wrap text-sm leading-relaxed"
            >
              {block.text}
            </p>
          );
        if (block.type === "table")
          return (
            <div key={index} className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="pb-2 text-left font-bold">
                  {block.caption}
                </caption>
                <thead>
                  <tr>
                    {block.headers.map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="border border-border bg-muted px-2 py-1 text-left"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="border border-border px-2 py-1 align-top"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        const asset = assets.get(String(block.assetId));
        return (
          <figure key={index} className="space-y-2">
            {asset?.url ? (
              // Signed Convex storage URLs are short-lived and not configured
              // as next/image remote patterns.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.url}
                alt={block.alt}
                width={asset.width || undefined}
                height={asset.height || undefined}
                className="h-auto max-w-full rounded-lg border border-border"
              />
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                Image unavailable. Alt text: {block.alt}
              </p>
            )}
            <figcaption className="text-sm leading-relaxed">
              {block.caption}
              <span className="mt-1 block text-muted-foreground">
                {block.description}
              </span>
            </figcaption>
          </figure>
        );
      })}
      <dl className="grid gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-bold">Origin</dt>
          <dd>{preview.reference.content.provenance.kind}</dd>
        </div>
        <div>
          <dt className="font-bold">Author</dt>
          <dd>{preview.reference.content.provenance.author}</dd>
        </div>
      </dl>
    </section>
  );
}
