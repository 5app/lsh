const sinon = require('sinon');
const {expect} = require('chai');
const TestLsh = require('./helpers/testLsh');
const Dummy = require('./helpers/dummy');
const data = require('./helpers/data');
const spy = require('./helpers/spy');

describe('Lsh', () => {
	context('Inheritance', () => {
		let dummy;
		let getColumnIdSlice;
		let getRowIdSlice;
		let getRowCount;
		let getShingles;
		let store;
		let finalise;
		const options = {forwared: true};
		const chunk = 50;

		before(async () => {
			dummy = new Dummy();

			({getColumnIdSlice,
				getRowIdSlice,
				getRowCount,
				getShingles,
				store,
				finalise} = spy(dummy));

			await dummy.run(options, chunk);
		});

		after(() => {
			sinon.restore();
		});

		it('forwards options data from "run" to "getColumnIdSlice", "getRowIdSlice", "getRowCount", "getShingles", "store" and "finalise"', async () => {
			sinon.assert.callCount(getColumnIdSlice, 2);
			sinon.assert.callCount(getRowIdSlice, 2);
			sinon.assert.calledOnce(getRowCount);
			sinon.assert.calledOnce(getShingles);
			sinon.assert.calledOnce(store);
			sinon.assert.calledOnce(finalise);

			expect(getColumnIdSlice.lastCall.args[0]).to.include(options);
			expect(getRowIdSlice.lastCall.args[0]).to.include(options);
			expect(getRowCount.lastCall.args[0]).to.include(options);
			expect(getShingles.lastCall.args[0]).to.include(options);
			expect(store.lastCall.args[0]).to.include(options);
			expect(finalise.lastCall.args[0]).to.include(options);
		});

		it('forwards chunk from "run" to "getColumnIdSlice" and "getRowIdSlice" as size property', () => {
			sinon.assert.callCount(getColumnIdSlice, 2);
			sinon.assert.callCount(getRowIdSlice, 2);

			expect(getColumnIdSlice.lastCall.args[0]).to.have.property('size');
			expect(getColumnIdSlice.lastCall.args[0].size).to.equal(chunk);

			expect(getRowIdSlice.lastCall.args[0]).to.have.property('size');
			expect(getRowIdSlice.lastCall.args[0].size).to.equal(chunk);
		});
	});

	context('MinHash', () => {
		let testLsh;
		let report;

		before(async () => {
			testLsh = new TestLsh();
			report = await testLsh.run();
		});

		it('covers all the provided data', async () => {
			expect(report.columns).to.equal(data.lists.length);
			expect(report.rows).to.equal(Object.keys(data.words).length);
		});

		it('hashes entries with low variance to similar minhashes', () => {
			const {minHash: mh0} = report.index[0];
			const {minHash: mh2} = report.index[2];

			const minHash0 = mh0.split(', ');
			const minHash2 = mh2.split(', ');

			let score = 0;

			minHash0.forEach((value, i) => {
				if (minHash2[i] !== value) return;

				score++;
			});

			const similarity = score / minHash0.length;

			expect(similarity).to.be.above(0.5);
		});

		it('hashes entries with significant variance to contrasting minhashes', () => {
			const {minHash: mh0} = report.index[0];
			const {minHash: mh10} = report.index[10];

			const minHash0 = mh0.split(', ');
			const minHash10 = mh10.split(', ');

			let score = 0;

			minHash0.forEach((value, i) => {
				if (minHash10[i] !== value) return;

				score++;
			});

			const similarity = score / minHash0.length;

			expect(similarity).to.equal(0);
		});
	});

	context('Chunking', () => {
		let regularLsh;
		let chunkedLsh;
		let regular;
		let chunked;
		let regularSpy;
		let chunkedSpy;

		before(async () => {
			regularLsh = new TestLsh();
			chunkedLsh = new TestLsh();

			regularSpy = spy(regularLsh);
			chunkedSpy = spy(chunkedLsh);

			regular = await regularLsh.run();
			chunked = await chunkedLsh.run({random: regular.random}, 5);
		});

		it('uses the random permutation initializer provided', () => {
			expect(chunked.random).to.equal(regular.random);
		});

		it('covers all the provided data', async () => {
			const lists = data.lists.length;
			const words = Object.keys(data.words).length;

			expect(chunked.columns).to.equal(lists);
			expect(chunked.rows).to.equal(words);
		});

		it('affects the number of computation blocks processed', () => {
			expect(chunked.blocks).to.be.above(regular.blocks);

			const same = ['getRowCount', 'finalise'];
			const more = ['getColumnIdSlice', 'getRowIdSlice', 'getShingles', 'store'];

			more.forEach(key => expect(chunkedSpy[key].callCount).to.be.above(regularSpy[key].callCount));
			same.forEach(key => expect(chunkedSpy[key].callCount).to.equal(regularSpy[key].callCount));
		});

		it('yields the same results as a bulk computation', () => {
			for (const id in regular.index) {
				expect(regular.index[id].minHash).to.equal(chunked.index[id].minHash);
			}
		});
	});
});
