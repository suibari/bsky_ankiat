/**
 * 共有画像に描くアバター。Bluesky の CDN は CORS を許可しておらず canvas から書き出せなくなるため、
 * ユーザーの PDS から元画像（blob）を取得する（PDS は CORS を許可している）。
 */
import { resolveIdentity } from '../atproto/identity';
import { getRecord } from '../atproto/publicRepo';

interface ProfileRecord {
	avatar?: { ref?: { $link?: string } };
}

export async function loadAvatarBitmap(did: string): Promise<ImageBitmap | undefined> {
	try {
		const record = await getRecord<ProfileRecord>(did, 'app.bsky.actor.profile', 'self');
		const cid = record?.value.avatar?.ref?.$link;
		if (!cid) return undefined;
		const { pds } = await resolveIdentity(did);
		const url = new URL('/xrpc/com.atproto.sync.getBlob', pds);
		url.searchParams.set('did', did);
		url.searchParams.set('cid', cid);
		const res = await fetch(url);
		if (!res.ok) return undefined;
		return await createImageBitmap(await res.blob());
	} catch {
		return undefined;
	}
}
