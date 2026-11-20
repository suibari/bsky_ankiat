/** デッキごとの「学習中の人数」（そのデッキを学習リストに追加しているユーザー数） */
import { parseAtUri } from '../atproto/records';

/**
 * @param subsByDid ユーザー（DID）ごとの、学習リストに入れたデッキの URI
 * 同じユーザーが同じデッキを重複して追加していても 1 人と数え、作者本人は数えない。
 */
export function countLearners(subsByDid: Map<string, string[]>): Map<string, number> {
	const counts = new Map<string, number>();
	for (const [did, uris] of subsByDid) {
		for (const uri of new Set(uris)) {
			let owner: string;
			try {
				owner = parseAtUri(uri).did;
			} catch {
				continue;
			}
			if (owner === did) continue;
			counts.set(uri, (counts.get(uri) ?? 0) + 1);
		}
	}
	return counts;
}
