const sinon = require('sinon');

module.exports = lsh => ({
	getColumnIdSlice: sinon.spy(lsh, 'getColumnIdSlice'),
	getRowIdSlice: sinon.spy(lsh, 'getRowIdSlice'),
	getRowCount: sinon.spy(lsh, 'getRowCount'),
	getShingles: sinon.spy(lsh, 'getShingles'),
	store: sinon.spy(lsh, 'store'),
	finalise: sinon.spy(lsh, 'finalise')
});
