"use client";

import Link from "next/link";

interface ResultActionsProps {
  jobId: string;
  characterId: string;
  assetUrl?: string;
  isSignedIn?: boolean;
  temporaryReferenceAssetId?: string;
}

export function ResultActions({
  jobId,
  characterId,
  assetUrl,
  isSignedIn = true,
  temporaryReferenceAssetId,
}: ResultActionsProps) {
  const temporaryReferenceHref = temporaryReferenceAssetId
    ? `/studio?characterId=${encodeURIComponent(characterId)}&jobId=${encodeURIComponent(jobId)}&inheritMode=edit&temporaryReferenceAssetId=${encodeURIComponent(temporaryReferenceAssetId)}&temporaryReferenceCharacterId=${encodeURIComponent(characterId)}`
    : null;

  return (
    <div className="stack-sm">
      <div className="btn-row">
        <Link className="btn btn-primary" href={`/studio?characterId=${characterId}&jobId=${jobId}&inheritMode=variation`}>
          Create Variation
        </Link>
        <Link className="btn btn-secondary" href={`/studio?characterId=${characterId}&jobId=${jobId}&inheritMode=edit`}>
          Edit Same Settings
        </Link>
        {isSignedIn ? (
          <Link className="btn btn-secondary" href={`/album?characterId=${characterId}`}>
            Album
          </Link>
        ) : null}
        {assetUrl ? (
          <a className="btn btn-ghost" download href={assetUrl}>
            Download
          </a>
        ) : null}
        {temporaryReferenceHref ? (
          <Link className="btn btn-ghost" href={temporaryReferenceHref}>
            Edit with Temporary Reference
          </Link>
        ) : null}
      </div>
    </div>
  );
}
