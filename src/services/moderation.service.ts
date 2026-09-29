import axios from "axios";
import config from "../../config";
import logger from "../utils/logger";
import toErrorMessage from "../utils/toErrorMessage";
import type { CommunityMediaItem } from "../types/community.types";

// Auto-moderation via the OpenAI omni-moderation endpoint. Disabled entirely
// when OPENAI_API_KEY is unset. The scan always fails open (never throws): a
// moderation outage must not block community posts or comments.

const MODERATION_TIMEOUT_MS = 5000;

interface ScanContentInput {
  text: string;
  media?: CommunityMediaItem[];
}

interface ScanResult {
  flagged: boolean;
  categories: string[];
}

interface ModerationResultEntry {
  flagged?: boolean;
  categories?: Record<string, boolean>;
}

interface ModerationApiResponse {
  results?: ModerationResultEntry[];
}

type ModerationInputPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

// Videos are sent as their thumbnail frame; a video without a thumbnail is
// skipped because the endpoint accepts text and image parts only.
function mediaToInputParts(
  media: CommunityMediaItem[] = []
): ModerationInputPart[] {
  const parts: ModerationInputPart[] = [];
  for (const item of media) {
    const url = item.type === "image" ? item.url : item.thumbnail_url;
    if (url) {
      parts.push({ type: "image_url", image_url: { url } });
    }
  }
  return parts;
}

async function scanContent(input: ScanContentInput): Promise<ScanResult> {
  const apiKey = config.openai.apiKey;
  if (!apiKey) {
    return { flagged: false, categories: [] };
  }

  try {
    const response = await axios.post<ModerationApiResponse>(
      "https://api.openai.com/v1/moderations",
      {
        model: "omni-moderation-latest",
        input: [
          { type: "text", text: input.text },
          ...mediaToInputParts(input.media),
        ],
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: MODERATION_TIMEOUT_MS,
      }
    );

    const results = response.data?.results ?? [];
    const categories = new Set<string>();
    let flagged = false;
    for (const result of results) {
      if (result.flagged) flagged = true;
      for (const [name, hit] of Object.entries(result.categories ?? {})) {
        if (hit) categories.add(name);
      }
    }
    return { flagged, categories: [...categories] };
  } catch (error) {
    logger.warn(
      `[Moderation] Content scan failed, allowing content through: ${toErrorMessage(error)}`
    );
    return { flagged: false, categories: [] };
  }
}

export = { scanContent };
