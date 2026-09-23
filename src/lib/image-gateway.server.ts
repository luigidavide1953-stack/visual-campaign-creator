export type ImageConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
};

export const imageSettings: Omit<ImageConfig, "apiKey"> = {
  baseURL: "https://ai.gateway.lovable.dev",
  model: "openai/gpt-image-2.5-sunburst",
};

export function editProductImage(config: ImageConfig, form: FormData) {
  const streaming = form.get("stream") !== "false";
  form.set("model", config.model);
  form.set("size", "1024x1024");
  form.set("quality", "high");
  if (streaming) {
    form.set("stream", "true");
    form.set("partial_images", "1");
  } else {
    form.delete("stream");
    form.delete("partial_images");
  }

  return fetch(`${config.baseURL}/v1/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
  });
}