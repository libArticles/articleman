import fastChunkString from '@shelf/fast-chunk-string';
import { Turnstile } from 'lib/concurrency';
import { compress, decompress } from 'compress-json';
import type { AMSharedLink, AMReferenceLink } from 'src/data/link';

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
	| boolean
	| StorableObject
	| StorableArray
	| null
	| undefined;

interface StorableObject extends Record<string, StorableValue> {}
interface StorableArray extends Array<StorableValue> {}

export default class StorageManager {
	static get(
		key: string,
		allowBadDigests?: 'UNSAFELY_ALLOW_BAD_DIGESTS' | undefined,
	) {
		const storage = PropertiesService.getDocumentProperties();
		const legendUnparsed = storage.getProperty(
			Names.universal + key + Names.legend,
		);
		if (!legendUnparsed)
			throw new Error('Legend not found for specified key');
		const legend: Legend = JSON.parse(legendUnparsed);
		const airlock: Record<string, string> = storage.getProperties();
		// storage.getKeys().filter((k) => k.startsWith(Names.universal + key)).forEach((k) => {
		// 	airlock[k] = JSON.parse(storage.getProperty(k));
		// });

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

	static set(key: string, value: StorableValue) {
		const turnstile = new Turnstile('storage_manager', 'document');
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

		// initialize variables
		let serializedValue: string;
		let dataType = typeof value;
		let isCompressed = false;

		// serialize the value

		// check if the value is an object
		if (dataType === 'object' && !Array.isArray(value) && value !== null) {
			serializedValue = JSON.stringify(compress(value as object));
			isCompressed = true;
		} else serializedValue = JSON.stringify(value);

		// initialize the airlock and storage
		const airlock: Record<string, string> = {};
		const storage = PropertiesService.getDocumentProperties();

		// compute the hash of the serialized value
		const hash = Utilities.computeDigest(
			Utilities.DigestAlgorithm.MD5,
			serializedValue,
			Utilities.Charset.UTF_8,
		)
			.map((byte) => ('0' + (byte & 0xff).toString(16)).slice(-2))
			.join('');

		// if the serialized value is too large, split it into multiple values
		let index = 0;
		if (serializedValue.length > 9200) {
			fastChunkString(serializedValue, { size: 9200 }).forEach((chunk) => {
				index++;
				airlock[Names.universal + key + '_' + index] = chunk;
			});
		} else {
			airlock[Names.universal + key] = serializedValue;
		}

		// add the legend
		airlock[Names.universal + key + Names.legend] = JSON.stringify({
			length: index,
			type: dataType,
			isCompressed,
			note: '!!!!    DO NOT MODIFY THIS ENTRY. DATA IS NOT MODIFIABLE AT REST, AS OBJECTS ARE COMPRESSED/OBFUSCATED BEFORE THEY ARE STORED. ANY ATTEMPT TO DO SO MAY NOT BE ILLEGAL, BUT IT *WILL* BREAK ARTICLEMAN NO MATTER WHAT. PLEASE USE THE lib/storage-manager API TO MODIFY THIS!    !!!!',
			digest: hash,
		} as Legend);

		storage.setProperties(airlock);
		turnstile.exit();
	}
}