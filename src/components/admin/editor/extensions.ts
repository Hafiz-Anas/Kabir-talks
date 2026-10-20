import { mergeAttributes, Node } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";

import { normalizeXStatusUrl, safeLinkHref } from "@/lib/content/urls";

/**
 * Editor extensions. Keep in sync with the allow-list in
 * src/lib/content/document.ts — the server strips anything not listed there.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tweet: {
      insertTweet: (url: string) => ReturnType;
    };
  }
}

/** X/Twitter post: we store only the URL; it renders as a link card. */
export const Tweet = Node.create({
  name: "tweet",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: null,
        parseHTML: (element) => normalizeXStatusUrl(element.getAttribute("data-url")),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-tweet]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const url = String(node.attrs.url ?? "");
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-tweet": "",
        "data-url": url,
        class: "kt-embed kt-embed-x",
        dir: "ltr",
        contenteditable: "false",
      }),
      ["span", { class: "kt-embed-x-label" }, "Post on X"],
      ["a", { href: url, target: "_blank", rel: "noopener noreferrer nofollow" }, url],
    ];
  },

  addCommands() {
    return {
      insertTweet:
        (url) =>
        ({ commands }) => {
          const normalized = normalizeXStatusUrl(url);
          return normalized ? commands.insertContent({ type: this.name, attrs: { url: normalized } }) : false;
        },
    };
  },
});

export function editorExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        protocols: ["mailto"],
        isAllowedUri: (url) => safeLinkHref(url) !== null,
        shouldAutoLink: (url) => safeLinkHref(url.includes(":") ? url : `https://${url}`) !== null,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: null },
      },
    }),
    Image.configure({ inline: false, allowBase64: false }),
    Youtube.configure({ nocookie: true, controls: true, modestBranding: true, addPasteHandler: true }),
    Tweet,
    Placeholder.configure({ placeholder }),
  ];
}
