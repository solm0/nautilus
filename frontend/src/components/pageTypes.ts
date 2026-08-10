export type MorphToken = {
  surface: string;
  lemma: string | null;
  pos: string | null;
};

export type Token = {
  surface: string;
  lemma: string | null;
  pos: string | null;
  morphs?: MorphToken[];
};

export type TextBlock = {
  text: string;
  timestamp_ms?: number | null;
  tokens?: Token[];
};

export type TextAnalysisResult = {
  text: string;
  blocks: TextBlock[];
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
  tokens: Token[];
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
