import { cache } from "react";
import { getPublishedContent as readPublishedContent } from "./store";

// React invalidates this memoization scope after every server request. This
// prevents duplicate layout/page reads without keeping publications stale.
export const getPublishedContent = cache(readPublishedContent);
