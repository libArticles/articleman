import fastChunkString from '@shelf/fast-chunk-string';
import { Turnstile } from 'lib/concurrency';
import { compress, decompress } from 'compress-json';
import type { AMSharedLink, AMReferenceLink } from 'src/data/link';
import type { UserStorage } from 'src/user-manager';
import { merge as _merge } from 'lodash';
import { SocketeerMessage, SocketeerMessageQueue } from 'src/comms/socket';

class Names {
	static universal = 'ARTICLEMAN_STORAGE_';
	static legend = '_LEGEND';
}

interface Legend {
	length: number;
	type: string;
	note: string;
	digest: string;
	isCompressed: boolean;
}

type StorableValue =
	| string
	| number
	| AMReferenceLink
	| AMSharedLink
	| UserStorage
	| SocketeerMessage
	| SocketeerMessageQueue
	| boolean
	| StorableObject
	| StorableArray
	| null
	| undefined;

interface StorableObject extends Record<string, StorableValue> {}
interface StorableArray extends Array<StorableValue> {}

export default class StorageManager {
	private static getFromStorage(
		scope: Scope,
		key: string,
		allowBadDigests?: 'UNSAFELY_ALLOW_BAD_DIGESTS' | undefined,
	) {
		const storage = this.getScopedStorage(scope);
		const legendUnparsed = storage.getProperty(
			Names.universal + key + Names.legend,
		);
		if (!legendUnparsed)
			throw new Error('Legend not found for specified key');
		const legend: Legend = JSON.parse(legendUnparsed);
		const airlock: Record<string, string> = storage.getProperties();

		return this.unFormat(legend, key, airlock, allowBadDigests ?? undefined);
	}

	private static unFormat(
		legend: Legend,
		key: string,
		airlock: Record<string, string>,
		allowBadDigests?: 'UNSAFELY_ALLOW_BAD_DIGESTS' | undefined,
	) {
		if (Object.keys(legend).length === 0) {
			return null;
		}

		// TODO: recombine according to legend

		const stringArray: string[] = [];

		for (let i = 0; i < legend.length; i++) {
			stringArray.push(airlock[Names.universal + key + '_' + i]);
		}

		const concatenatedString = stringArray.join('');

		// hash the final object and see if it matches the legend
		const hash = Utilities.computeDigest(
			Utilities.DigestAlgorithm.MD5,
			concatenatedString,
		)
			.map((byte) => ('0' + (byte & 0xff).toString(16)).slice(-2))
			.join('');

		if (
			hash === legend.digest ||
			allowBadDigests === 'UNSAFELY_ALLOW_BAD_DIGESTS'
		) {
			switch (legend.type) {
				case 'STRING':
					return concatenatedString;
				default:
					if (legend.isCompressed)
						return decompress(JSON.parse(concatenatedString));
					else return JSON.parse(concatenatedString);
			}
		} else if (allowBadDigests !== 'UNSAFELY_ALLOW_BAD_DIGESTS') {
			// TODO: standardize error
			throw new Error(
				`StorageManager data couldn't be retrieved and/or stored losslessly. The digests don't match. Expected ${legend.digest}, got ${hash}. Use UNSAFELY_ALLOW_BAD_DIGESTS to ignore the digest check.`,
			);
		}
	}

	private static format(
		key: string,
		value: StorableValue,
		allowCompression: boolean = true,
		computeDigest: boolean = true,
		chunkSize: number = 9100,
	) {
		// initialize variables
		let serializedValue: string;
		let dataType = typeof value;
		let isCompressed = false;

		// serialize the value

		// check if the value is an object
		if (
			dataType === 'object' &&
			!Array.isArray(value) &&
			value !== null &&
			allowCompression === true
		) {
			serializedValue = JSON.stringify(compress(value as object));
			isCompressed = true;
		} else serializedValue = JSON.stringify(value);

		// initialize the airlock
		const airlock: Record<string, string> = {};

		let hash = '';

		// compute the hash of the serialized value
		if (computeDigest === true) {
			hash = Utilities.computeDigest(
				Utilities.DigestAlgorithm.MD5,
				serializedValue,
				Utilities.Charset.UTF_8,
			)
				.map((byte) => ('0' + (byte & 0xff).toString(16)).slice(-2))
				.join('');
		}

		// if the serialized value is too large, split it into multiple values
		let index = 0;
		if (serializedValue.length > chunkSize) {
			fastChunkString(serializedValue, { size: chunkSize }).forEach(
				(chunk) => {
					index++;
					airlock[Names.universal + key + '_' + index] = chunk;
				},
			);
		} else {
			airlock[Names.universal + key] = serializedValue;
		}

		// add the legend
		airlock[Names.universal + key + Names.legend] = JSON.stringify({
			length: index,
			type: dataType,
			isCompressed,
			note: "!!!!    This storage is NOT modifiable! Do not try to directly modify any value here or anywhere else in the Properties service that has the ARTICLEMAN_STORAGE namespace. Articleman compresses, and by extension obfuscates all data stored by StorageManager, and checks digests when reading! If you would like to modify this storage, either enter Developer Mode as an admin or recompile the app yourself, importing the 'lib/storage-manager' API when writing code.     !!!!",
			digest: hash,
		} as Legend);

		return airlock;
	}

	private static getScopedStorage(scope: Scope) {
		switch (scope) {
			case 'document':
				return PropertiesService.getDocumentProperties();
			case 'script':
				return PropertiesService.getScriptProperties();
			case 'user':
				return PropertiesService.getUserProperties();
			default:
				throw new Error('Unknown scope');
		}
	}

	private static getScopedCache(scope: Scope) {
		switch (scope) {
			case 'document':
				return CacheService.getDocumentCache();
			case 'script':
				return CacheService.getScriptCache();
			case 'user':
				return CacheService.getUserCache();
			default:
				throw new Error('Unknown scope');
		}
	}

	private static getFromCache(
		scope: Scope,
		key: string,
		fastMode: boolean = false,
	) {
		const cache = this.getScopedCache(scope);
		const legend = JSON.parse(
			cache.get(Names.universal + key + Names.legend),
		);
		const chunkNames: string[] = [];

		for (let i = 0; i < legend.length; i++) {
			const chunkName = Names.universal + key + '_' + i;
			chunkNames.push(chunkName);
		}

		const airlock: Record<string, string> = cache.getAll(chunkNames);

		return this.unFormat(
			legend,
			key,
			airlock,
			fastMode ? 'UNSAFELY_ALLOW_BAD_DIGESTS' : undefined,
		);
	}

	private static setCache(
		scope: Scope,
		key: string,
		value: StorableValue,
		fastMode: boolean = false,
	) {
		const cache = this.getScopedCache(scope);
		const airlock = this.format(key, value, false, !fastMode, 100000000);
		cache.putAll(airlock);
	}

	private static setStorage(scope: Scope, key: string, value: StorableValue) {
		const turnstile = new Turnstile('storage_manager', scope);
		console.time('StorageManagerTurnstile');
		if (turnstile.enter(20000)) {
			console.timeEnd('StorageManagerTurnstile');
			console.log(`Went through the turnstile for StorageManager`);
		} else {
			// TODO: standardize error
			throw new Error(
				'Unable to use Turnstile on Storage Manager, Articleman seems dangerously busy.',
			);
		}

		const storage = this.getScopedStorage(scope);
		const airlock = this.format(key, value, true);

		storage.setProperties(airlock);
		turnstile.exit();
	}

	static document = {
		getStored: (key: string) =>
			StorageManager.getFromStorage('document', key),
		store: (key: string, value: StorableValue) =>
			StorageManager.setStorage('document', key, value),
		mergeStore: (key: string, value: StorableValue) =>
			StorageManager.document.store(
				key,
				_merge(StorageManager.document.getStored(key), value),
			),
		cache: (key: string, value: StorableValue) => {
			StorageManager.setCache('document', key, value);
		},
		cacheFast: (key: string, value: StorableValue) => {
			StorageManager.setCache('document', key, value, true);
		},
		getCached: (key: string) => StorageManager.getFromCache('document', key),
		getCachedFast: (key: string) =>
			StorageManager.getFromCache('document', key, true),
		deleteStored: (key: string) => StorageManager.setStorage('document', key, null),
	};

	static script = {
		getStored: (key: string) => StorageManager.getFromStorage('script', key),
		store: (key: string, value: StorableValue) =>
			StorageManager.setStorage('script', key, value),
		mergeStore: (key: string, value: StorableValue) =>
			StorageManager.script.store(
				key,
				_merge(StorageManager.script.getStored(key), value),
			),
		cache: (key: string, value: StorableValue) => {
			StorageManager.setCache('script', key, value);
		},
		cacheFast: (key: string, value: StorableValue) => {
			StorageManager.setCache('script', key, value, true);
		},
		getCached: (key: string) => StorageManager.getFromCache('script', key),
		getCachedFast: (key: string) =>
			StorageManager.getFromCache('script', key, true),
		deleteStored: (key: string) => StorageManager.setStorage('script', key, null),
	};

	static user = {
		store: (key: string) => StorageManager.getFromStorage('user', key),
		getStored: (key: string, value: StorableValue) =>
			StorageManager.setStorage('user', key, value),
		mergeStore: (key: string, value: StorableValue) =>
			StorageManager.user.getStored(
				key,
				_merge(StorageManager.user.store(key), value),
			),
		cache: (key: string, value: StorableValue) => {
			StorageManager.setCache('user', key, value);
		},
		cacheFast: (key: string, value: StorableValue) => {
			StorageManager.setCache('user', key, value, true);
		},
		getCached: (key: string) => StorageManager.getFromCache('user', key),
		getCachedFast: (key: string) =>
			StorageManager.getFromCache('user', key, true),
		deleteStored: (key: string) => StorageManager.setStorage('user', key, null),
	};
}

type Scope = 'document' | 'script' | 'user';
