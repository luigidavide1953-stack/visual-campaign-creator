import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Expand,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { streamImage } from "@/lib/stream-image";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Product Visual AI | إنشاء إعلانات المنتجات بالذكاء الاصطناعي" },
      { name: "description", content: "حوّل صورة منتجك إلى تصميمين إعلانيين احترافيين جاهزين للنشر على Instagram." },
      { property: "og:title", content: "Product Visual AI" },
      { property: "og:description", content: "أنشئ صورتين إعلانيتين احترافيتين من صورة منتج واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Language = "ar" | "en";
type Result = { src?: string; final: boolean; loading: boolean; error?: string };

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const emptyResult: Result = { final: false, loading: false };

function createPrompt(style: "studio" | "lifestyle", language: Language, name: string, details: string, copy: string) {
  const isArabic = language === "ar";
  const entered = [
    name && `اسم المنتج كما أدخله المستخدم: “${name}”`,
    details && `المزايا أو الوصف كما أدخله المستخدم: “${details}”`,
    copy && `النص الإعلاني المطلوب حرفياً: “${copy}”`,
  ].filter(Boolean).join("\n");
  const direction = style === "studio"
    ? "صمّم إعلاناً استوديو فاخراً بخلفية أنيقة محايدة، إضاءة ناعمة، ظلال واقعية، وتكوين تجاري راقٍ."
    : "صمّم إعلاناً مختلفاً بأسلوب Lifestyle واقعي يوضّح سياق استخدام المنتج وفائدته، بخلفية وتكوين وألوان مختلفة بوضوح عن إعلان الاستوديو.";
  return `استخدم الصورة المرفقة مرجعاً وحيداً للمنتج. أنشئ صورة إعلانية مربعة 1:1 بدقة عالية مناسبة لـ Instagram. ${direction}

قواعد إلزامية: حافظ بدقة شديدة على شكل المنتج وأبعاده وألوانه وخاماته وملصقه وعبوته وكل تفاصيله المرئية. أظهر نسخة واحدة فقط من المنتج واجعلها العنصر الرئيسي. لا تضف منتجات أو شعارات أو أسعاراً أو خصومات أو عروضاً أو ادعاءات غير موجودة في بيانات المستخدم. لا تعِد تصميم المنتج ولا تشوّهه.

النص داخل الإعلان يجب أن يكون ${isArabic ? "بالعربية الصحيحة، من اليمين إلى اليسار" : "بالإنجليزية الصحيحة"}، قصيراً وواضحاً ومقروءاً على الهاتف. أضف عنواناً إعلانياً، ومن ميزتين إلى أربع مزايا قصيرة فقط عند توفرها في البيانات، ودعوة بسيطة لاتخاذ إجراء مثل “${isArabic ? "اطلبه الآن" : "Shop now"}”. لا تخترع مزايا. إذا لم يُدخل المستخدم معلومات كافية، استخدم عبارات عامة غير ادعائية. تجنّب ازدحام النص.

${entered || "لم يقدّم المستخدم نصوصاً؛ استخدم نصاً عاماً قصيراً غير ادعائي."}`;
}

function Index() {
  const fileInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [copy, setCopy] = useState("");
  const [language, setLanguage] = useState<Language>("ar");
  const [results, setResults] = useState<[Result, Result]>([{ ...emptyResult }, { ...emptyResult }]);
  const [fullView, setFullView] = useState<string>();
  const generating = results.some((result) => result.loading);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const acceptFile = (next?: File) => {
    if (!next) return;
    if (!allowedTypes.includes(next.type)) {
      toast.error("صيغة الملف غير مدعومة. استخدم JPG أو PNG أو WEBP.");
      return;
    }
    if (next.size > 15 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً. الحد الأقصى 15 ميجابايت.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setResults([{ ...emptyResult }, { ...emptyResult }]);
    toast.success("تم رفع صورة المنتج بنجاح.");
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => acceptFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    acceptFile(event.dataTransfer.files?.[0]);
  };

  const generateOne = async (index: 0 | 1) => {
    if (!file) {
      toast.error("يرجى رفع صورة المنتج أولاً.");
      fileInput.current?.click();
      return;
    }
    setResults((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, loading: true, error: undefined, final: false }
      : item) as [Result, Result]);
    const form = new FormData();
    form.append("image", file);
    form.append("prompt", createPrompt(index === 0 ? "studio" : "lifestyle", language, name, details, copy));
    try {
      await streamImage("/api/edit-image", form, (src, final) => {
        setResults((current) => current.map((item, itemIndex) => itemIndex === index
          ? { src, final, loading: !final }
          : item) as [Result, Result]);
      });
      setResults((current) => current.map((item, itemIndex) => itemIndex === index
        ? { ...item, loading: false, final: true }
        : item) as [Result, Result]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل إنشاء الصورة.";
      setResults((current) => current.map((item, itemIndex) => itemIndex === index
        ? { ...item, loading: false, error: message }
        : item) as [Result, Result]);
      throw error;
    }
  };

  const generateBoth = async () => {
    if (!file) {
      toast.error("يرجى رفع صورة المنتج أولاً.");
      fileInput.current?.click();
      return;
    }
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    const settled = await Promise.allSettled([generateOne(0), generateOne(1)]);
    const successes = settled.filter((item) => item.status === "fulfilled").length;
    if (successes === 2) toast.success("تم إنشاء التصميمين بنجاح.");
    else if (successes === 1) toast.warning("اكتمل تصميم واحد. يمكنك إعادة إنشاء التصميم الآخر.");
    else toast.error("فشل إنشاء الصور. يرجى المحاولة مجدداً.");
  };

  const download = (src: string, index: number) => {
    const anchor = document.createElement("a");
    anchor.href = src;
    anchor.download = `product-visual-${index + 1}.png`;
    anchor.click();
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <Toaster position="top-center" richColors dir="rtl" />
      <header className="border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3" aria-label="Product Visual AI">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-premium"><Sparkles /></span>
            <div><p className="text-base font-bold">Product Visual AI</p><p className="text-xs text-muted-foreground">استوديو إعلانات المنتجات</p></div>
          </div>
          <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"><span className="size-2 rounded-full bg-green-600" /> مدعوم بالذكاء الاصطناعي</span>
        </div>
      </header>

      <section className="subtle-grid relative border-b border-border/60">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center md:py-20">
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-ink-soft shadow-sm"><Sparkles className="size-4" /> صورتان إعلانيتان من صورة واحدة</div>
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.35] md:text-6xl">حوّل صورة منتجك إلى <span className="text-ink-soft">إعلان احترافي</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">ارفع صورة منتجك ودع الذكاء الاصطناعي ينشئ لك صورتين جاهزتين للنشر.</p>
          <Button variant="premium" size="xl" className="mt-8" onClick={() => fileInput.current?.click()}><UploadCloud /> رفع صورة المنتج</Button>
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-2 text-right">
            {["رفع صورة المنتج", "إضافة بيانات المنتج", "إنشاء وتحميل التصميمين"].map((step, index) => (
              <div key={step} className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground md:text-sm"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary font-bold text-secondary-foreground">{index + 1}</span><span>{step}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
        <div>
          <SectionTitle number="01" title="صورة المنتج" subtitle="يفضل استخدام صورة واضحة بخلفية بسيطة" />
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFileChange} />
          {preview ? (
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
              <img src={preview} alt="معاينة المنتج المرفوع" className="h-full w-full rounded-md object-contain" />
              <Button variant="outline" size="icon" className="absolute left-7 top-7 bg-background/90" onClick={() => fileInput.current?.click()} title="استبدال الصورة"><RefreshCw /></Button>
              <div className="absolute inset-x-7 bottom-7 flex items-center gap-2 rounded-md bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur"><Check className="size-4 text-green-700" /><span className="min-w-0 truncate">{file?.name}</span></div>
            </div>
          ) : (
            <div onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={() => fileInput.current?.click()} className="group flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-input bg-card px-6 text-center shadow-sm transition-colors hover:border-primary">
              <span className="mb-5 grid size-16 place-items-center rounded-lg bg-secondary text-secondary-foreground transition-transform group-hover:-translate-y-1"><ImagePlus className="size-7" /></span>
              <p className="font-bold">اسحب صورة المنتج هنا</p><p className="mt-2 text-sm text-muted-foreground">أو اضغط لاختيار صورة من جهازك</p><p className="mt-5 text-xs text-muted-foreground">JPG · PNG · WEBP — حتى 15MB</p>
            </div>
          )}
        </div>

        <div>
          <SectionTitle number="02" title="بيانات الإعلان" subtitle="كل الحقول اختيارية، وسنستخدم ما تضيفه فقط" />
          <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm md:p-7">
            <Field label="اسم المنتج" hint="اختياري"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: عطر سكون" className="h-12" /></Field>
            <Field label="وصف المنتج أو أهم مزاياه" hint="اختياري"><Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="مثال: رائحة خشبية هادئة، ثبات طويل، عبوة 100 مل" className="min-h-28 resize-none" /></Field>
            <Field label="النص الإعلاني المطلوب" hint="اختياري"><Input value={copy} onChange={(e) => setCopy(e.target.value)} placeholder="مثال: حضورٌ يبقى" className="h-12" /></Field>
            <fieldset><legend className="mb-2 text-sm font-semibold">لغة النص الإعلاني</legend><div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1.5">
              {([['ar', 'العربية'], ['en', 'English']] as const).map(([value, label]) => <Button type="button" variant={language === value ? "secondary" : "ghost"} key={value} onClick={() => setLanguage(value)} className="h-11">{label}</Button>)}
            </div></fieldset>
            <Button variant="premium" size="xl" className="w-full" disabled={generating} onClick={generateBoth}>{generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{generating ? "جاري إنشاء التصاميم..." : "إنشاء صورتين إعلانيتين"}<ArrowLeft className="mr-auto" /></Button>
            <p className="text-center text-xs leading-6 text-muted-foreground">قد يستغرق إنشاء التصميمين بضع دقائق حسب التفاصيل.</p>
          </div>
        </div>
      </section>

      <section ref={resultsRef} className="border-t border-border bg-muted/45 scroll-mt-4">
        <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 lg:py-16">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <SectionTitle number="03" title="التصميمات الإعلانية" subtitle={generating ? "جاري إنشاء التصاميم الإعلانية..." : "نتيجتان مختلفتان جاهزتان للمعاينة والتنزيل"} />
            {results.some((item) => item.src) && <Button variant="outline" onClick={generateBoth} disabled={generating}><RefreshCw /> إنشاء تصميمين جديدين</Button>}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {results.map((result, index) => <ResultCard key={index} index={index} result={result} onRegenerate={() => generateOne(index as 0 | 1)} onDownload={download} onExpand={setFullView} />)}
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-primary py-8 text-primary-foreground"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 text-center text-sm md:flex-row md:px-8"><strong>Product Visual AI</strong><span className="opacity-70">صور منتجات أقوى، في وقت أقل.</span></div></footer>

      {fullView && <div role="dialog" aria-modal="true" aria-label="معاينة بالحجم الكامل" className="fixed inset-0 z-50 grid place-items-center bg-foreground/90 p-4" onClick={() => setFullView(undefined)}><Button variant="secondary" size="icon" className="absolute left-5 top-5" onClick={() => setFullView(undefined)} title="إغلاق"><X /></Button><img src={fullView} alt="التصميم بالحجم الكامل" className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-premium" onClick={(e) => e.stopPropagation()} /></div>}
    </main>
  );
}

function SectionTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return <div className="mb-5"><div className="flex items-center gap-3"><span className="text-xs font-bold text-muted-foreground">{number}</span><h2 className="text-xl font-bold md:text-2xl">{title}</h2></div><p className="mt-2 text-sm text-muted-foreground">{subtitle}</p></div>;
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return <div><div className="mb-2 flex items-center justify-between"><Label className="font-semibold">{label}</Label><span className="text-xs text-muted-foreground">{hint}</span></div>{children}</div>;
}

function ResultCard({ index, result, onRegenerate, onDownload, onExpand }: { index: number; result: Result; onRegenerate: () => void; onDownload: (src: string, index: number) => void; onExpand: (src: string) => void }) {
  const label = index === 0 ? "استوديو فاخر" : "أسلوب واقعي";
  return <article className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
    <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="text-sm font-bold">التصميم {index + 1}</p><p className="text-xs text-muted-foreground">{label} · 1:1</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">Instagram</span></div>
    <div className="relative aspect-square overflow-hidden bg-secondary/40">
      {result.src ? <img src={result.src} alt={`التصميم الإعلاني ${index + 1}`} className={`h-full w-full object-cover transition-[filter] duration-700 ${result.final ? "blur-0" : "blur-2xl"}`} /> : <div className="flex h-full flex-col items-center justify-center px-8 text-center text-muted-foreground"><span className="mb-4 grid size-14 place-items-center rounded-lg border border-border bg-card"><ImagePlus /></span><p className="text-sm">سيظهر التصميم {index + 1} هنا</p></div>}
      {result.loading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/55 backdrop-blur-sm"><LoaderCircle className="size-8 animate-spin" /><p className="mt-4 text-sm font-semibold animate-soft-pulse">جاري إنشاء التصميم...</p></div>}
      {result.error && <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 p-8 text-center"><p className="text-sm font-semibold text-destructive">تعذّر إنشاء هذا التصميم</p><p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{result.error}</p><Button variant="outline" className="mt-4" onClick={onRegenerate}><RefreshCw /> إعادة المحاولة</Button></div>}
    </div>
    <div className="grid grid-cols-[1fr_auto_auto] gap-2 p-3"><Button disabled={!result.final} onClick={() => result.src && onDownload(result.src, index)}><Download /> تحميل الصورة</Button><Button variant="outline" size="icon" disabled={!result.final} onClick={() => result.src && onExpand(result.src)} title="معاينة بالحجم الكامل"><Expand /></Button><Button variant="outline" size="icon" disabled={result.loading} onClick={onRegenerate} title="إنشاء نسخة جديدة"><RefreshCw /></Button></div>
  </article>;
}