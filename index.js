const PAD = 8; // the number of bits in an integer
const EXP_ZEROS = /^([0])\1+$/; // e.g. EXP_ZEROS.test('0000') === true

class Lsh {
  /**
   * LSH computation object.
   *
   * Throws if the number of permutations (B * R) > 400
   *
   * @param  {number} B - the number of band per permutation (max bucket per column)
   * @param  {number} R - the number of row per bucket
   */
  constructor(B = 25, R = 8) {
    const permutations = B * R;

    if (permutations > 400)
      throw new Error(`LSH permutations (${B} * ${R}) limited to 400`);

    this.B = B;
    this.R = R;
    this.permutations = permutations;
  }

  /**
   * Get a slice of column ids
   *
   * @param  {object} options - base column slice options appended by run options
   * @param  {number} options.cursor_id - last id of the previous slice
   * @param  {number} options.size - size of the slice
   * @returns {Promise<number[]>} - slice of column ids
   */
  // eslint-disable-next-line no-unused-vars
  async getColumnIdSlice({cursor_id, size} = {}) {
    throw new TypeError(
      'Lsh.getColumnIdSlice(options) has not been implemented'
    );
  }

  /**
   * Get a slice of row ids
   *
   * @param  {object} options - base row slice options appended by run options
   * @param  {number} options.cursor_id - last id of the previous slice
   * @param  {number} options.size} - size of the slice
   * @returns {Promise<number[]>} - slice of row ids
   */
  // eslint-disable-next-line no-unused-vars
  async getRowIdSlice({cursor_id, size} = {}) {
    throw new TypeError(
      'Lsh.getRowIdSlice(options) has not been implemented'
    );
  }

  /**
   * Get total number of rows
   *
   * @param  {object} options - run options
   * @returns {Promise<number>} - number of rows
   */
  // eslint-disable-next-line no-unused-vars
  async getRowCount(options = {}) {
    throw new TypeError(
      'Lsh.getRowCount(options) has not been implemented'
    );
  }

  /**
   * Get shingles or k-grams for a given column/row set
   *
   * @param {object} options - base shingle options appended by run options
   * @param  {number[]} options.column_ids - [description]
   * @param  {number[]} options.row_ids}  - [description]
   * @returns {object<number, object<number, boolean>>} - object such that (shingles[row_id][column_id] === true) if a row an a column are associated
   */
  // eslint-disable-next-line no-unused-vars
  async getShingles({column_ids, row_ids} = {}) {
    throw new TypeError(
      'Lsh.getShingles(options) has not been implemented'
    );
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
    const {permutations, R} = this;
    const data = {};

    let column_cursor_id = 0;
    let column_round = 0;
    let column_count = 0;
    let row_round = 0;
    const total = await this.getRowCount(options); // TODO: prime number based implementation of RPA

    const {
      random = Math.floor(Math.random() * total), // random offset (hash genesis)
    } = options;

    while (hasMore) {
      // get column id slice
      // eslint-disable-next-line no-await-in-loop
      const column_ids = await this.getColumnIdSlice({
        ...options,
        cursor_id: column_cursor_id,
        size: chunk,
      });

      if (!column_ids || !column_ids.length) break;

      // TODO: parallele processing ("by" sets of columns)

      const buckets = {}; // { [bucket_id]: [...user_ids]  }
      const index = {}; // { [user_id]: {minHash, bucket_ids} }

      row_round = 0;
      let row_cursor_id = 0;

      column_round++;

      const c_count = column_ids.length;
      column_cursor_id = column_ids[c_count - 1];
      column_count += c_count;

      // permutation table
      const minHash = {};

      // prepare permutations for each columns

      column_ids.forEach(column_id => {
        const hash = (minHash[column_id] = new Array(permutations));

        for (let i = 0; i < permutations; i++) {
          hash[i] = 0;
        }
      });

      // compute permutations for each columns

      while (hasMore) {
        // get row id slice
        // eslint-disable-next-line no-await-in-loop
        const row_ids = await this.getRowIdSlice({
          ...options,
          cursor_id: row_cursor_id,
          size: chunk,
        });

        if (!row_ids || !row_ids.length) break;

        // eslint-disable-next-line no-await-in-loop
        const shingles = await this.getShingles({
          ...options,
          column_ids,
          row_ids,
        });

        const row_offset = row_round * chunk;
        row_round++;

        const r_count = row_ids.length;
        row_cursor_id = row_ids[r_count - 1];

        // Min

        column_ids.forEach(column_id => {
          const hash = minHash[column_id];

          for (let i = 0; i < r_count; i++) {
            const row_id = row_ids[i];
            const row = shingles[row_id];

            // skip if no data (e.g. for colum=user and row=playlist, user has not done a playlist)
            if (!row || !row[column_id]) continue;

            for (let j = 0; j < permutations; j++) {
              const rand = random + j; // random permutation approximation = RPA
              const perm = (row_offset + i + rand) % total; // permutation hash

              const value = hash[j];

              hash[j] = value > 0 ? Math.min(value, perm) : perm;
            }
          }
        });
      }

      // Hash

      for (const column_id in minHash) {
        let mh = '';
        const hash = minHash[column_id];
        const bucket_ids = [];

        for (let i = 0; i < hash.length; i += R) {
          // slicing bucket indices
          let bucket_id = '';
          const b = hash.slice(i, i + R);

          for (let j = 0; j < R; j++) {
            // transpose index into hex and left pad with 0
            const num = b[j];
            const hex = num.toString(16);
            bucket_id += hex.padStart(PAD, '0');
          }

          mh += bucket_id; // concatenate the bucket index to the user minHash
          // skip "empty" bucket (i.e. when the user hasn't done any playlist)
          if (EXP_ZEROS.test(bucket_id)) continue;

          const bucket =
            buckets[bucket_id] || (buckets[bucket_id] = new Set());

          bucket_ids.push(bucket_id);
          bucket.add(column_id);
        }

        if (bucket_ids.length) {
          index[column_id] = {minHash: mh, bucket_ids};
        }
      }

      // store slice index and buckets

      // eslint-disable-next-line no-await-in-loop
      await this.store({
        ...options,
        buckets,
        index,
        stamp,
        data,
      });
    }

    const blocks = column_round * row_round;

    const report = await this.finalise({
      ...options,
      blocks,
      columns: column_count,
      rows: total,
      stamp,
      data,
    });

    const end = Date.now();
    const duration = end - begin;

    return {
      ...report,
      blocks,
      random,
      duration,
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
    throw new TypeError('Lsh.storeSlice(options) has not been implemented');
  }

  /**
   * [finalise description]
   *
   * @param  {object} options - base finalisation options appended by run options
   * @param  {number} options.blocks  - number or computed blocks
   * @param  {number} options.columns - number of processed columns
   * @param  {number} options.rows    - number of processed rows
   * @param  {Date} options.stamp   - computation timestamp
   * @param  {object} options.data}  - custom implementation data
   * @returns {Promise<void>} -
   */
  // eslint-disable-next-line no-unused-vars
  async finalise({blocks, columns, rows, stamp, data} = {}) {
    throw new TypeError('Lsh.finalise(options) has not been implemented');
  }
}

module.exports = Lsh;
