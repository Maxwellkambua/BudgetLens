// lib/types.ts
export type Source = {
  doc: string;
  page: number;
  snippet: string;
};

export type AskResponse = {
  answer: string;
  sources: Source[];
  matchedGolden?: boolean;
};