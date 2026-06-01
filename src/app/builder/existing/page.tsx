import { ExistingCharacterBuilder } from "@/components/existing-character-builder";

export const dynamic = "force-dynamic";

export default function ExistingBuilderPage() {
  return (
    <div className="page-content">
      <div className="page-title-block">
        <h1 className="heading-xl">Import Existing Character</h1>
        <p className="page-subtitle">Register reference sheets or character art you already own, separately from the AI builder flow.</p>
      </div>
      <ExistingCharacterBuilder />
    </div>
  );
}
