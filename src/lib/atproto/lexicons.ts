/** AnkiAt の Lexicon NSID（docs/SPEC.md 4章） */
export const NSID = {
	deck: 'com.suibari.ankiat.deck',
	cardChunk: 'com.suibari.ankiat.cardChunk',
	reviewLog: 'com.suibari.ankiat.reviewLog',
	subscription: 'com.suibari.ankiat.subscription',
	ankiSync: 'com.suibari.ankiat.ankiSync',
	preferences: 'com.suibari.ankiat.preferences'
} as const;

export type Collection = (typeof NSID)[keyof typeof NSID];
