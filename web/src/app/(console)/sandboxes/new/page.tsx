import {
  CreateSandboxForm,
  type CreateMode,
  type SourceKind,
} from "@/components/sandboxes/create-sandbox-form";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function NewSandboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolved = await searchParams;
  const fromSnapshot = firstValue(resolved.fromSnapshot);
  const fromTemplate = firstValue(resolved.fromTemplate);
  const fromImage = firstValue(resolved.fromImage);

  const sourceKind: SourceKind = fromSnapshot ? "snapshot" : "template";
  const sourceId = fromSnapshot || fromTemplate;
  const mode: CreateMode = !sourceId && fromImage ? "cold" : "template";

  return (
    <CreateSandboxForm
      initialMode={mode}
      initialSourceKind={sourceKind}
      initialSourceId={sourceId}
      initialImage={fromImage}
    />
  );
}
