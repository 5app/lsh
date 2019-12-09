class Lsh {
	/**
	 * LSH computation object.
	 *
	 * Throws if the number of permutations (bands * height) > Lsh.limit (default: 400)
	 *
	 * @param  {number} bands - the number of bands in a permutation (max bucket per column)
	 * @param  {number} height - the number of rows per band
	 */
	constructor(bands = 25, height = 8) {
		const {limit, name} = this.constructor;

		if (!Number.isInteger(limit) || limit < 0)
			throw new Error('static Lsh.limit must be a positive integer');

		if (!Number.isInteger(bands) || bands < 0)
			throw new Error(`new ${ name }(bands, height): bands must be a positive integer`);

		if (!Number.isInteger(height) || height < 0)
			throw new Error(`new ${ name }(bands, height): height must be a positive integer`);

		const permutations = bands * height;

		if (permutations > limit)
			throw new Error(
				`${ name } permutations (${bands} * ${height}) must be ≤ ${limit}`
			);

		this.bands = bands;
		this.height = height;
		this.permutations = permutations;
	}

	/**
	 * Get a slice of column ids
	 *
	 * @param  {object} options - base column slice options appended by run options
	 * @param  {*} options.cursorId - last id of the previous slice
	 * @param  {number} options.size - size of the slice
	 * @returns {Promise<number[]>} - slice of column ids
	 */
	// eslint-disable-next-line no-unused-vars
	async getColumnIdSlice({cursorId, size} = {}) {
		throw new TypeError(
			'Lsh.getColumnIdSlice(options) has not been implemented'
		);
	}

	/**
	 * Get a slice of row ids
	 *
	 * @param  {object} options - base row slice options appended by run options
	 * @param  {*} options.cursorId - last id of the previous slice
	 * @param  {number} options.size} - size of the slice
	 * @returns {Promise<number[]>} - slice of row ids
	 */
	// eslint-disable-next-line no-unused-vars
	async getRowIdSlice({cursorId, size} = {}) {
		throw new TypeError('Lsh.getRowIdSlice(options) has not been implemented');
	}

	/**
	 * Get total number of rows
	 *
	 * @param  {object} options - run options
	 * @returns {Promise<number>} - number of rows
	 */
	// eslint-disable-next-line no-unused-vars
	async getRowCount(options = {}) {
		throw new TypeError('Lsh.getRowCount(options) has not been implemented');
	}

	/**
	 * Get shingles or k-grams for a given column/row set
	 *
	 * @param {object} options - base shingle options appended by run options
	 * @param  {*[]} options.columnIds - column ids
	 * @param  {*[]} options.rowIds} - row ids
	 * @returns {object<number, object<number, boolean>>} - object such that (shingles[rowId][columnId] === true) if a row an a column are associated
	 */
	// eslint-disable-next-line no-unused-vars
	async getShingles({columnIds, rowIds} = {}) {
		throw new TypeError('Lsh.getShingles(options) has not been implemented');
	}

	/**
	 * Run Lsh minhash forwarding options to the each class method called
	 *
	 * @param  {object} options - computation options to be forwarded to class methods
	 * @param  {number} options.by - number of column sets to compute simultaneously
	 * @param  {number} options.random - random number to compute permutation hash
	 * @param  {number} chunk - size column and row slices per computation block
	 * @returns {Promise<object>} - result of the computation finalisation
	 */
	async run(options = {by: 1}, chunk = 100) {
		const hasMore = true;
		const stamp = new Date();
		const begin = stamp.getTime();
		const {permutations, height} = this;
		const {ignore, signature, format} = this.constructor;
		const data = {};

		let columnCursorId;
		let columnRound = 0;
		let columnCount = 0;
		let rowRound = 0;
		const total = await this.getRowCount(options);

		const {
			random = Math.floor(Math.random() * total) // random offset (hash genesis)
		} = options;

		while (hasMore) {
			// get column id slice
			// eslint-disable-next-line no-await-in-loop
			const columnIds = await this.getColumnIdSlice({
				...options,
				cursorId: columnCursorId,
				size: chunk
			});

			if (!columnIds || !columnIds.length) break;

			// TODO: parallele processing ("by" sets of columns)

			const buckets = {}; // { [bucketId]: [...columnIds]  }
			const index = {}; // { [columnId]: {minHash, bucketIds} }

			rowRound = 0;
			let rowCursorId;

			columnRound++;

			const cCount = columnIds.length;
			columnCursorId = columnIds[cCount - 1];
			columnCount += cCount;

			// permutation table
			const minHash = {};

			// prepare permutations for each columns

			columnIds.forEach(columnId => {
				const hash = (minHash[columnId] = new Array(permutations));

				for (let i = 0; i < permutations; i++) {
					hash[i] = 0;
				}
			});

			// compute permutations for each columns

			while (hasMore) {
				// get row id slice
				// eslint-disable-next-line no-await-in-loop
				const rowIds = await this.getRowIdSlice({
					...options,
					cursorId: rowCursorId,
					size: chunk
				});

				if (!rowIds || !rowIds.length) break;

				// eslint-disable-next-line no-await-in-loop
				const shingles = await this.getShingles({
					...options,
					columnIds,
					rowIds
				});

				if (!shingles) throw new TypeError('Lsh.getShingles(options) returned no data');

				const rowOffset = rowRound * chunk;
				rowRound++;

				const rCount = rowIds.length;
				rowCursorId = rowIds[rCount - 1];

				// Min

				columnIds.forEach(columnId => {
					const hash = minHash[columnId];

					for (let i = 0; i < rCount; i++) {
						const rowId = rowIds[i];
						const row = shingles[rowId];

						// skip if no data
						// (e.g. for colum = article and row = word,
						// the word has never been used
						// or the article does not use it)
						if (!row || !row[columnId]) continue;

						for (let j = 0; j < permutations; j++) {
							const rand = random + j; // random permutation approximation
							const perm = ((rowOffset + i + rand) % total) + 1; // permutation hash

							const value = hash[j];

							hash[j] = value > 0 ? Math.min(value, perm) : perm;
						}
					}
				});
			}

			// Hash

			for (const columnId in minHash) {
				let mh = '';
				let k = 0;
				let valued;
				const hash = minHash[columnId];
				const bucketIds = [];

				for (let i = 0; i < hash.length; i += height) {
					// slicing bucket indices
					let bucketId = '';
					const b = hash.slice(i, i + height);

					for (let j = 0; j < height; j++) {
						// transpose index into hex and left pad with 0
						bucketId += signature(b[j], j);
					}

					mh += format(bucketId, k++); // concatenate the bucket index to the column minHash
					bucketIds.push(bucketId);
					// skip "empty" bucket (i.e. when an article is not related to any row)
					if (ignore(bucketId)) continue;

					const bucket = buckets[bucketId] || (buckets[bucketId] = new Set());

					bucket.add(columnId);
					valued = true;
				}

				if (!valued) continue;

				index[columnId] = {minHash: mh, bucketIds};
			}

			// store slice index and buckets

			// eslint-disable-next-line no-await-in-loop
			await this.store({
				...options,
				buckets,
				index,
				stamp,
				data
			});
		}

		const blocks = columnRound * rowRound;

		const report = await this.finalise({
			...options,
			blocks,
			columns: columnCount,
			rows: total,
			stamp,
			data
		});

		const end = Date.now();
		const duration = end - begin;

		return {
			...report,
			blocks,
			random,
			duration
		};
	}

	/**
	 * Store index and buckets for a given column/row set
	 *
	 * @param  {object} options - base slice storing options appended by run options
	 * @param  {object} options.index - index representation of a given column/row set
	 * @param  {object} options.buckets - bucket distribution of a given column set
	 * @param  {Date} options.stamp - computation timestamp
	 * @param  {object} options.data} - custom implementation data
	 * @returns {Promise<void>} -
	 */
	// eslint-disable-next-line no-unused-vars
	async store({index, buckets, stamp, data} = {}) {
		throw new TypeError('Lsh.store(options) has not been implemented');
	}

	/**
	 * Finalise Lsh computation
	 *
	 * @param  {object} options - base finalisation options appended by run options
	 * @param  {number} options.blocks - number or computed blocks
	 * @param  {number} options.columns - number of processed columns
	 * @param  {number} options.rows - number of processed rows
	 * @param  {Date} options.stamp - computation timestamp
	 * @param  {object} options.data} - custom implementation data
	 * @returns {Promise<void>} -
	 */
	// eslint-disable-next-line no-unused-vars
	async finalise({blocks, columns, rows, stamp, data} = {}) {
		throw new TypeError('Lsh.finalise(options) has not been implemented');
	}

	/**
	 * Maximum number of permutations
	 *
	 * @returns {number} -
	 */
	static get limit() {
		return 400;
	}

	// eslint-disable-next-line jsdoc/require-returns-check
	/**
	 * Whether a bucket id has to be ignored for storage.
	 *
	 * @param  {string}  bucketId - bucket id
	 * @returns {boolean} - true if the bucketId can be ignored
	 */
	// eslint-disable-next-line no-unused-vars
	static ignore(bucketId) {
		throw new TypeError('static Lsh.ignore(bucketId) has not been implemented');
	}

	// eslint-disable-next-line jsdoc/require-returns-check
	/**
	 * Turn the numerical value of a signature into string
	 * to build a bucket id.
	 *
	 * @param  {number} value - signature value
	 * @param  {number} index - position of the value in a band
	 * @returns {string} - stringified signature value
	 */
	// eslint-disable-next-line no-unused-vars
	static signature(value, index) {
		throw new TypeError(
			'static Lsh.signature(value, index) has not been implemented'
		);
	}

	// eslint-disable-next-line jsdoc/require-returns-check
	/**
	 * Format a bucket id to build a column's minhash
	 *
	 * @param  {string} bucketId - bucket id
	 * @param  {number} index - position of the band in the minhash
	 * @returns {string} - appendable version form of a given band
	 */
	// eslint-disable-next-line no-unused-vars
	static format(bucketId, index) {
		throw new TypeError(
			'static Lsh.format(bucketId, index) has not been implemented'
		);
	}
}

module.exports = Lsh;
