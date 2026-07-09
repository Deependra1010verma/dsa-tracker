export type SubCategory = {
  id: string; // slug or identifier used for roadmapSection filtering
  label: string; // display name
};

export const topicSubCategories: Record<string, SubCategory[]> = {
  // Example topic slugs – ensure your topics have matching "slug" fields in the DB
  array: [
    { id: "basic-array", label: "Basic Array" },
    { id: "two-pointer", label: "Two‑Pointer" },
    { id: "sliding-window", label: "Sliding Window" },
  ],
  string: [
    { id: "basic-string", label: "Basic String" },
    { id: "rolling-hash", label: "Rolling Hash" },
    { id: "suffix-array", label: "Suffix Array" },
  ],
  // Add further topics as needed (graph, tree, dp, etc.)
};
