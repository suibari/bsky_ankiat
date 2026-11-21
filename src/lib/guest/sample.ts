/** LP でめくれる見本カード（docs/SPEC.md 3.7）。PDS のデッキではなく、回答も保存しない */
import type { Locale } from '../i18n/messages';

export interface SampleCard {
	front: string;
	back: string;
}

export const SAMPLE_CARDS: Record<Locale, SampleCard[]> = {
	ja: [
		{ front: '光合成で、植物が取り込む気体は？', back: '二酸化炭素' },
		{ front: '“ephemeral” の意味は？', back: 'つかの間の、はかない' },
		{ front: '日本でいちばん長い川は？', back: '信濃川' },
		{
			front: 'AnkiAt で、思い出せなかったときに押すボタンは？',
			back: '「もう一度」（すぐにまた出ます）'
		}
	],
	en: [
		{ front: 'Which gas do plants take in for photosynthesis?', back: 'Carbon dioxide' },
		{ front: 'What does “ephemeral” mean?', back: 'Lasting for a very short time' },
		{ front: 'What is the capital of Australia?', back: 'Canberra' },
		{
			front: "In AnkiAt, which button do you press when you couldn't remember?",
			back: '“Again” (the card comes back soon)'
		}
	]
};
