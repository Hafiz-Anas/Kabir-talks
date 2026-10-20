"use client";

import { NodeSelection } from "@tiptap/pm/state";
import { type Editor, EditorContent, type JSONContent, useEditor, useEditorState } from "@tiptap/react";
import {
  AtSign,
  Bold,
  Clapperboard,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countWords, readingMinutes } from "@/lib/content/document";
import { normalizeXStatusUrl, parseYouTubeId, safeLinkHref, youTubeWatchUrl } from "@/lib/content/urls";
import { cn } from "@/lib/utils";

import { SelectionAi } from "../ai/selection-ai";
import { editorExtensions } from "./extensions";
import { uploadImage } from "./upload-image";

type Locale = "en" | "ur";

export function RichTextEditor({
  locale,
  initialContent,
  onChange,
  onReady,
  uploadsEnabled,
  label,
  ai,
}: {
  locale: Locale;
  initialContent: JSONContent | null;
  onChange: (doc: JSONContent) => void;
  onReady?: (editor: Editor) => void;
  uploadsEnabled: boolean;
  label: string;
  /** Selected-text AI menu; omit when AI is off. */
  ai?: { imagePrefix: string | null; onAccepted: () => void };
}) {
  const rtl = locale === "ur";
  const editor = useEditor({
    extensions: editorExtensions(rtl ? "اپنی خبر یہاں لکھیں…" : "Write your story…"),
    content: initialContent ?? undefined,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn("kt-prose px-4 py-4 sm:px-6", rtl && "font-urdu"),
        dir: rtl ? "rtl" : "ltr",
        lang: locale,
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  const stats = useEditorState({
    editor,
    selector: ({ editor }) => {
      const words = editor ? countWords(editor.getText({ blockSeparator: " " })) : 0;
      return { words, minutes: readingMinutes(words, locale) };
    },
  });

  return (
    <div className="overflow-hidden rounded-md border border-input bg-black focus-within:border-gold-muted">
      {editor ? <Toolbar editor={editor} uploadsEnabled={uploadsEnabled} /> : <div className="h-11 border-b border-border" />}
      <EditorContent editor={editor} />
      {editor && ai && <SelectionAi editor={editor} locale={locale} imagePrefix={ai.imagePrefix} onAccepted={ai.onAccepted} />}
      <div className="flex justify-end gap-3 border-t border-border px-4 py-2 text-xs text-grey" dir="ltr">
        <span>{stats?.words ?? 0} words</span>
        <span aria-hidden>·</span>
        <span>{stats?.minutes ?? 0} min read</span>
      </div>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active ?? undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()} // keep the editor selection
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-sm text-grey transition-colors hover:bg-obsidian-raised hover:text-ivory disabled:pointer-events-none disabled:opacity-40",
        active && "bg-obsidian-raised text-gold",
      )}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

type DialogKind = "link" | "image" | "youtube" | "tweet" | null;

/**
 * Chain for inserting a block embed. If a node (e.g. a just-inserted video)
 * is selected, move the cursor after it first — otherwise the new embed
 * would replace the selected one.
 */
function blockChain(editor: Editor) {
  const { selection } = editor.state;
  const chain = editor.chain().focus();
  return selection instanceof NodeSelection ? chain.setTextSelection(selection.to) : chain;
}

function Toolbar({ editor, uploadsEnabled }: { editor: Editor; uploadsEnabled: boolean }) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      blockquote: editor.isActive("blockquote"),
      link: editor.isActive("link"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();
  const separator = <span aria-hidden className="mx-1 h-5 w-px bg-border" />;

  return (
    <>
      <div role="toolbar" aria-label="Formatting" dir="ltr" className="flex flex-wrap items-center gap-0.5 border-b border-border bg-obsidian px-2 py-1.5">
        <ToolButton icon={Heading2} label="Heading 2" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
        <ToolButton icon={Heading3} label="Heading 3" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
        {separator}
        <ToolButton icon={Bold} label="Bold (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()} />
        <ToolButton icon={Italic} label="Italic (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()} />
        <ToolButton icon={Underline} label="Underline (Ctrl+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()} />
        <ToolButton icon={Strikethrough} label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()} />
        {separator}
        <ToolButton icon={List} label="Bulleted list" active={state.bulletList} onClick={() => chain().toggleBulletList().run()} />
        <ToolButton icon={ListOrdered} label="Numbered list" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()} />
        <ToolButton icon={Quote} label="Blockquote" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()} />
        <ToolButton icon={Minus} label="Horizontal rule" onClick={() => chain().setHorizontalRule().run()} />
        {separator}
        <ToolButton icon={LinkIcon} label="Add link" active={state.link} onClick={() => setDialog("link")} />
        {state.link && <ToolButton icon={Unlink} label="Remove link" onClick={() => chain().extendMarkRange("link").unsetLink().run()} />}
        <ToolButton
          icon={ImagePlus}
          label={uploadsEnabled ? "Insert image" : "Image uploads not configured"}
          disabled={!uploadsEnabled}
          onClick={() => setDialog("image")}
        />
        <ToolButton icon={Clapperboard} label="Embed YouTube video" onClick={() => setDialog("youtube")} />
        <ToolButton icon={AtSign} label="Embed X/Twitter post" onClick={() => setDialog("tweet")} />
        {separator}
        <ToolButton icon={Undo2} label="Undo (Ctrl+Z)" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
        <ToolButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" disabled={!state.canRedo} onClick={() => chain().redo().run()} />
      </div>

      <LinkDialog editor={editor} open={dialog === "link"} onClose={() => setDialog(null)} />
      <ImageDialog editor={editor} open={dialog === "image"} onClose={() => setDialog(null)} />
      <UrlEmbedDialog
        open={dialog === "youtube"}
        onClose={() => setDialog(null)}
        title="Embed a YouTube video"
        description="Paste a youtube.com or youtu.be link. Videos play from youtube-nocookie.com."
        placeholder="https://www.youtube.com/watch?v=…"
        validate={(value) => (parseYouTubeId(value) ? null : "Only youtube.com or youtu.be video links are allowed.")}
        onSubmit={(value) => blockChain(editor).setYoutubeVideo({ src: youTubeWatchUrl(parseYouTubeId(value)!) }).run()}
      />
      <UrlEmbedDialog
        open={dialog === "tweet"}
        onClose={() => setDialog(null)}
        title="Embed an X/Twitter post"
        description="Paste the link to a post on x.com or twitter.com. It’s stored as a link card."
        placeholder="https://x.com/user/status/…"
        validate={(value) => (normalizeXStatusUrl(value) ? null : "Only x.com or twitter.com post (status) links are allowed.")}
        onSubmit={(value) => blockChain(editor).insertTweet(value).run()}
      />
    </>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return children ? (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  ) : null;
}

function LinkDialog({ editor, open, onClose }: { editor: Editor; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="border-border bg-obsidian">{open && <LinkForm editor={editor} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

/** Mounted fresh each time the dialog opens, so its state starts from the current selection. */
function LinkForm({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const id = useId();
  const [value, setValue] = useState(() => String(editor.getAttributes("link").href ?? ""));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const raw = value.trim();
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    const href = safeLinkHref(candidate);
    if (!href) {
      setError("Only http://, https:// and mailto: links are allowed.");
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text: raw, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-ivory">Add link</DialogTitle>
        <DialogDescription>Allowed: http://, https:// and mailto: links.</DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <Label htmlFor={id}>URL</Label>
        <Input id={id} dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://…" autoFocus />
        <FieldError>{error}</FieldError>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="hover:bg-gold-soft">
            Apply
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

type EmbedProps = {
  title: string;
  description: string;
  placeholder: string;
  validate: (value: string) => string | null;
  onSubmit: (value: string) => void;
};

function UrlEmbedDialog({ open, onClose, ...props }: EmbedProps & { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="border-border bg-obsidian">{open && <UrlEmbedForm {...props} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function UrlEmbedForm({ title, description, placeholder, validate, onSubmit, onClose }: EmbedProps & { onClose: () => void }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-ivory">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const problem = validate(value.trim());
          if (problem) return setError(problem);
          onSubmit(value.trim());
          onClose();
        }}
        className="space-y-3"
      >
        <Label htmlFor={id}>Link</Label>
        <Input id={id} dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoFocus />
        <FieldError>{error}</FieldError>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="hover:bg-gold-soft">
            Embed
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function ImageDialog({ editor, open, onClose }: { editor: Editor; open: boolean; onClose: () => void }) {
  const [uploading, setUploading] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !uploading && onClose()}>
      <DialogContent className="border-border bg-obsidian">
        {open && <ImageForm editor={editor} onClose={onClose} onUploadingChange={setUploading} />}
      </DialogContent>
    </Dialog>
  );
}

function ImageForm({
  editor,
  onClose,
  onUploadingChange,
}: {
  editor: Editor;
  onClose: () => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const fileId = useId();
  const altId = useId();
  const captionId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const uploading = progress !== null;
  const setBusy = (value: number | null) => {
    setProgress(value);
    onUploadingChange(value !== null);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-ivory">Insert image</DialogTitle>
        <DialogDescription>JPEG, PNG, WebP or AVIF, up to 5 MB. Alt text is required.</DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!file) return setError("Choose an image.");
          if (!alt.trim()) return setError("Alt text is required: describe the image for screen-reader users.");
          setError(null);
          setBusy(0);
          try {
            const src = await uploadImage(file, setProgress);
            blockChain(editor).setImage({ src, alt: alt.trim(), title: caption.trim() || undefined }).run();
            setBusy(null);
            onClose();
          } catch (err) {
            setBusy(null);
            setError(err instanceof Error ? err.message : "Upload failed.");
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={fileId}>Image file</Label>
          <Input
            id={fileId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview before upload
            <img src={preview} alt="" className="max-h-48 rounded-md border border-border object-contain" />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={altId}>Alt text (required)</Label>
          <Input id={altId} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} disabled={uploading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={captionId}>Caption (optional)</Label>
          <Input id={captionId} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} disabled={uploading} />
        </div>
        {uploading && <UploadProgress value={progress} />}
        <FieldError>{error}</FieldError>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button type="submit" disabled={uploading} className="hover:bg-gold-soft">
            {uploading ? "Uploading…" : "Upload and insert"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function UploadProgress({ value }: { value: number }) {
  return (
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label="Upload progress"
        className="h-1.5 overflow-hidden rounded-full bg-obsidian-raised"
      >
        <div className="h-full bg-gold transition-[width]" style={{ width: `${value}%` }} />
      </div>
      <p className="text-xs text-grey">{value < 100 ? `Uploading… ${value}%` : "Verifying image…"}</p>
    </div>
  );
}
