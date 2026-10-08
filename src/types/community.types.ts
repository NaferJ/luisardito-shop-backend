// Shared types for the Community feature (posts, comments, likes).
// Kept in a separate module because the model files use `export =`
// (CommonJS), which cannot be combined with other exported elements.

export type CommunityStatus = "visible" | "pending_review" | "hidden";

export interface CommunityMediaItem {
  type: "image" | "video";
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

export type CommunityLikeTarget = "post" | "comment";

export type CommunityReportTarget = "post" | "comment";

export type CommunityReportReason =
  "spam" | "harassment" | "hate" | "sexual" | "violence" | "other";

export type CommunityReportStatus = "open" | "resolved" | "dismissed";

export type CommunityFeedSort = "new" | "top" | "hot";
