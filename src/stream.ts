export function parseServerSentEvents(input: string): unknown[] {
  return input.split(/\r?\n\r?\n/u).flatMap((frame) => {
    const data = frame.split(/\r?\n/u).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data) return [];
    try { return [JSON.parse(data)]; } catch { return [data]; }
  });
}
