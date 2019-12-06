const Lsh = require('../../.');

class Dummy extends Lsh {
	getColumnIdSlice({cursorId}) {
		return cursorId ? [] : [1];
	}

	getRowIdSlice({cursorId}) {
		return cursorId ? [] : [1];
	}

	getRowCount() {
		return 1;
	}

	getShingles() {
		return {[1]: {[1]: true}};
	}

	store() {

	}

	finalise() {

	}

	static signature(value) {
		return `${value}`;
	}

	static format(bucketId) {
		return bucketId;
	}

	static ignore() {
		return false;
	}
}

module.exports = Dummy;