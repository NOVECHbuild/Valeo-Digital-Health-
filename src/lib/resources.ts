// ════════════════════════════════════════════════════════════════════════════
//  Resources library — shared types & category metadata
//  Used by the client-facing Resources page and the doctor/admin manager.
// ════════════════════════════════════════════════════════════════════════════

export type ResourceCategory = "books" | "watch" | "read" | "guides";

export interface Resource {
  id:          string;
  title:       string;
  description: string;
  category:    ResourceCategory;
  url:         string;
  source?:     string;   // e.g. "Amazon", "YouTube", "Nation News"
  coverImage?: string;   // optional image URL (used mainly for books)
  storagePath?: string;  // set when the file was uploaded to Firebase Storage
  featured?:   boolean;  // show first / highlighted
  createdBy?:  string;
  createdAt?:  any;
  updatedAt?:  any;
}

// Category metadata. `action` is the call-to-action label on the client card.
export const RESOURCE_CATEGORIES: {
  key:     ResourceCategory;
  label:   string;
  blurb:   string;
  action:  string;
}[] = [
  { key: "books",  label: "Books",  blurb: "Published works",                      action: "Get the book"   },
  { key: "watch",  label: "Watch",  blurb: "Videos & inspirational clips",         action: "Watch"          },
  { key: "read",   label: "Read",   blurb: "Articles, columns & blog posts",       action: "Read"           },
  { key: "guides", label: "Guides", blurb: "Downloadable guides & worksheets",     action: "Open"           },
];

export const CATEGORY_LABEL: Record<ResourceCategory, string> =
  RESOURCE_CATEGORIES.reduce((acc, c) => { acc[c.key] = c.label; return acc; },
    {} as Record<ResourceCategory, string>);

export const CATEGORY_ACTION: Record<ResourceCategory, string> =
  RESOURCE_CATEGORIES.reduce((acc, c) => { acc[c.key] = c.action; return acc; },
    {} as Record<ResourceCategory, string>);
