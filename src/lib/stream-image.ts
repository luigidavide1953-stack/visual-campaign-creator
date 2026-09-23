import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type ImagePayload = { type?: string; b64_json?: string; error?: { message?: string } };

export async function streamImage(
  endpoint: string,
  input: FormData,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<void> {
  const send = (stream: boolean) => {
    const form = new FormData();
    input.forEach((value, name) => form.append(name, value));
    form.set("stream", String(stream));
    if (!stream) form.delete("partial_images");
    return fetch(endpoint, { method: "POST", body: form });
  };

  const response = await send(true);
  if (!response.ok || !response.body) {
    const message = await response.text().catch(() => "");
    throw new Error(message || "تعذّر إنشاء الصورة.");
  }

  let sawEvent = false;
  let sawCompleted = false;
  let streamError: string | undefined;
  const parser = createParser({
    onEvent(event) {
      let payload: ImagePayload | undefined;
      try {
        payload = JSON.parse(event.data) as ImagePayload;
      } catch {
        return;
      }
      if (event.event === "error" || payload.type === "error") {
        sawEvent = true;
        streamError = payload.error?.message || "فشل إنشاء الصورة.";
        return;
      }
      const type = event.event || payload.type;
      const isFinal = type === "image_generation.completed" || type === "image_edit.completed";
      const isPartial = type === "image_generation.partial_image" || type === "image_edit.partial_image";
      if (!isFinal && !isPartial) return;
      sawEvent = true;
      if (!payload.b64_json) {
        streamError = "لم تصل بيانات الصورة كاملة.";
        return;
      }
      flushSync(() => onFrame(`data:image/png;base64,${payload?.b64_json}`, isFinal));
      if (isFinal) sawCompleted = true;
    },
  });

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<string>;
      try {
        chunk = await reader.read();
      } catch (error) {
        if (sawEvent) throw error;
        break;
      }
      if (chunk.done) break;
      parser.feed(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (streamError) throw new Error(streamError);
  if (!sawEvent) {
    const replay = await send(false);
    if (!replay.ok) {
      const message = await replay.text().catch(() => "");
      throw new Error(message || "تعذّر إنشاء الصورة.");
    }
    const json = (await replay.json()) as { data?: { b64_json?: string }[] };
    const image = json.data?.[0]?.b64_json;
    if (!image) throw new Error("لم يُرجع النموذج صورة.");
    onFrame(`data:image/png;base64,${image}`, true);
    return;
  }
  if (!sawCompleted) throw new Error("توقّف إنشاء الصورة قبل اكتمالها.");
}