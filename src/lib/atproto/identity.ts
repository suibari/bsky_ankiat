/** DID ドキュメントを解決して PDS とハンドルを得る（docs/SPEC.md 3.3） */

export interface ResolvedIdentity {
	did: string;
	pds: string;
	handle?: string;
}

const PLC_DIRECTORY = 'https://plc.directory';
const cache = new Map<string, Promise<ResolvedIdentity>>();

interface DidDocument {
	alsoKnownAs?: string[];
	service?: { id: string; type: string; serviceEndpoint: string }[];
}

async function fetchDidDocument(did: string): Promise<DidDocument> {
	let url: string;
	if (did.startsWith('did:plc:')) {
		url = `${PLC_DIRECTORY}/${did}`;
	} else if (did.startsWith('did:web:')) {
		const host = decodeURIComponent(did.slice('did:web:'.length));
		url = `https://${host}/.well-known/did.json`;
	} else {
		throw new Error(`unsupported DID method: ${did}`);
	}
	const res = await fetch(url);
	if (!res.ok) throw new Error(`failed to resolve ${did}: HTTP ${res.status}`);
	return res.json();
}

export function resolveIdentity(did: string): Promise<ResolvedIdentity> {
	let p = cache.get(did);
	if (!p) {
		p = fetchDidDocument(did).then((doc) => {
			const pds = doc.service?.find(
				(s) => s.id.endsWith('#atproto_pds') && s.type === 'AtprotoPersonalDataServer'
			)?.serviceEndpoint;
			if (!pds) throw new Error(`no PDS found for ${did}`);
			const handle = doc.alsoKnownAs
				?.find((a) => a.startsWith('at://'))
				?.slice('at://'.length);
			return { did, pds: pds.replace(/\/$/, ''), handle };
		});
		p.catch(() => cache.delete(did));
		cache.set(did, p);
	}
	return p;
}
