export type Token = {
  surface: string;
  lemma: string | null;
  pos: string | null;
  dep: string | null;
  ipa?: string | null;
};

export type PatternSearchResponse = {
  status:
    | "ok"
    | "unsupported_language"
    | "insufficient_selection"
    | "missing_pack";
  message: string | null;
  query: {
    tokens: Token[];
    sketch: {
      fine: string[];
      pos: string[];
      coarse: string[];
      deps: string[];
      lemmas: string[];
      anchors: string[];
    };
  } | null;
  results: Array<{
    language: string;
    line_id: number;
    score: number;
    tokens: Token[];
    match_start: number;
    match_end: number;
    match_sketch: {
      fine: string[];
      pos: string[];
      coarse: string[];
      deps: string[];
      lemmas: string[];
      anchors: string[];
    };
    anchor_score: number;
    pos_score: number;
    dep_score: number;
    lemma_score: number;
    structure_score: number;
    boundary_score: number;
    shared_anchor_count: number;
  }>;
};

export type OCRBlock = {
  text: string;
  timestamp_ms?: number | null;
  tokens?: Token[];
};

export type OCRResponse = {
  text: string;
  blocks: OCRBlock[];
  track_ref?: TrackReference | null;
};

export type TrackReference = {
  source: string;
  provider_track_id: string | null;
  uri: string | null;
  isrc: string | null;
  title_normalized: string;
  artists_normalized: string[];
  duration_ms: number | null;
};

export type PageSource = "user" | "chrome" | "lrclib" | string;

export type KwicData = {
  line_id: number;
  match_indices: number[];
  tokens: { lemma: string; pos: string; surface: string; dep: string }[];
};

export type LemmaData = {
  key: string;
  kwic: KwicData[];
  related: string[];
  is_favorite: boolean;
  global_key: string;
};

export type AnnotationType = "link" | "memo" | "emoji";

export type AnnotationBase = {
  id?: number;
  user_id?: number;
  page_id: number;
  start_index: number;
  end_index: number;
  created_at?: string;
};

export type LinkAnnotation = AnnotationBase & {
  type: "link";
  content: string;
};

export type MemoAnnotation = AnnotationBase & {
  type: "memo";
  content: string;
};

export type EmojiAnnotation = AnnotationBase & {
  type: "emoji";
  content: string;
};

export type Annotation = LinkAnnotation | MemoAnnotation | EmojiAnnotation;
