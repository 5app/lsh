const Lsh = require('../../src/');
const data = require('./data');
const words = Object.keys(data.words);
const {lists} = data;

class TestLsh extends Lsh {
	constructor(bands = 3, height = 3) {
		super(bands, height);
	}

	getColumnIdSlice({cursorId = 0, size = 20} = {}) {
		const ids = [];

		if (cursorId < lists.length) {
			let i = 0;
			let id = cursorId === 0 ? cursorId : cursorId + 1;

			while (i < size && id < lists.length) {
				ids.push(id++);
				i++;
			}
		}

		return ids;
	}

	getRowIdSlice({cursorId, size = 20} = {}) {
		let i = 0;
		const ids = [];
		const start = cursorId ? words.indexOf(cursorId) : 0;
		const index = cursorId ? start + 1 : start;

		while (i < size && index + i < words.length) {
			ids.push(words[index + i]);
			i++;
		}

		return ids;
	}

	getRowCount() {
		return words.length;
	}

	async getShingles({columnIds, rowIds} = {}) {
		const shingles = {};
		const {words: map} = data;

		rowIds.forEach(word => {
			if (!map[word]) return;

			const kgram = (shingles[word] = {});

			columnIds.forEach(id => {
				kgram[id] = map[word].includes(id);
			});
		});

		return shingles;
	}

	store({index, buckets, data} = {}) {
		const istore = data.index || (data.index = {});
		const bstore = data.buckets || (data.buckets = {});

		Object.assign(istore, index);

		for (const bucket_id in buckets) {
			const bucket = buckets[bucket_id];
			const set = bstore[bucket_id];

			bstore[bucket_id] = set ? new Set([...set, ...bucket]) : bucket;
		}
	}

	finalise({blocks, columns, rows, stamp, data} = {}) {
		return {
			stamp,
			blocks,
			columns,
			rows,
			...data
		};
	}

	static signature(value, index) {
		return TestLsh.format(value, index);
	}

	static format(bucketId, index) {
		return `${index ? ', ' : ''}${bucketId}`;
	}

	static ignore(bucketId) {
		return /0((, )?)/.test(bucketId);
	}
}

module.exports = TestLsh;
