import { createFileRoute } from "@tanstack/react-router";
import { editProductImage, imageSettings } from "@/lib/image-gateway.server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const Route = createFileRoute("/api/edit-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("خدمة الذكاء الاصطناعي غير مهيأة.", { status: 500 });

        const form = await request.formData();
        const image = form.get("image");
        const prompt = form.get("prompt");
        if (!(image instanceof File) || !allowedTypes.has(image.type)) {
          return new Response("يرجى رفع صورة بصيغة JPG أو PNG أو WEBP.", { status: 400 });
        }
        if (image.size > 15 * 1024 * 1024) {
          return new Response("حجم الصورة أكبر من 15 ميجابايت.", { status: 400 });
        }
        if (typeof prompt !== "string" || !prompt.trim()) {
          return new Response("تعليمات التصميم مطلوبة.", { status: 400 });
        }

        const upstream = await editProductImage({ ...imageSettings, apiKey }, form);
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});