/** 学習リスト（subscription）の状態をページ間で共有する */
import type { Agent } from '@atproto/api';
import { adjustCachedLearners } from '../search/index';
import { listSubscriptions, subscribe, unsubscribe } from './data';

export const learning = $state<{ uris: string[] | undefined }>({ uris: undefined });
let loading: Promise<void> | undefined;

export function loadLearning(did: string): Promise<void> {
	loading ??= listSubscriptions(did)
		.then((subs) => {
			learning.uris = [...new Set(subs.map((s) => s.deck))];
		})
		.catch(() => {
			loading = undefined;
		});
	return loading;
}

export function isLearning(uri: string): boolean | undefined {
	return learning.uris?.includes(uri);
}

/** 学習リストへの追加・削除。成功したら true（追加後）/ false（削除後） */
export async function toggleLearning(agent: Agent, did: string, uri: string): Promise<boolean> {
	if (isLearning(uri)) {
		await unsubscribe(agent, did, uri);
		learning.uris = learning.uris?.filter((u) => u !== uri);
		void adjustCachedLearners(uri, -1);
		return false;
	}
	await subscribe(agent, did, uri);
	learning.uris = [...(learning.uris ?? []), uri];
	void adjustCachedLearners(uri, 1);
	return true;
}

/** 学習リストから外したとき（ホームなど、別の経路で外した場合）に状態を合わせる */
export function forgetLearning(uri: string) {
	learning.uris = learning.uris?.filter((u) => u !== uri);
	void adjustCachedLearners(uri, -1);
}
