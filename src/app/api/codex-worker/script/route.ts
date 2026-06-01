import { getCodexWorkerScriptMetadata, readCodexWorkerScript } from "@/lib/codex-worker-script";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [script, metadata] = await Promise.all([
      readCodexWorkerScript(),
      getCodexWorkerScriptMetadata(),
    ]);

    return new Response(script, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="vchara-codex-worker.mjs"',
        "Content-Type": "application/javascript; charset=utf-8",
        "X-VChara-Script-SHA256": metadata.sha256,
      },
    });
  } catch {
    return Response.json({ message: "Codex worker script is not available." }, { status: 404 });
  }
}
