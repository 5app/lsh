# Locality Sensitive Hashing [![Greenkeeper badge](https://badges.greenkeeper.io/5app/lsh.svg)](https://greenkeeper.io/) [![CircleCI](https://circleci.com/gh/5app/lsh.svg?style=shield)](https://circleci.com/gh/5app/lsh)
> Scalable MinHash computation


## Getting Started

### Prerequisites
- node 8 or higher

### Installation
```bash
npm i @5app/lsh
```
### Usage

1. Customise the base class for your dataset
```javascript
const Lsh = require('@5app/lsh')
const B = 10;
const R = 5;

class MyDataLsh extends Lsh {
  constructor (bands = B, height = R) { // set default permutation params
    super(bands, height)
  }

  async getColumnIdSlice ({ cursorId, size, ...custom }) {
    // return a number {size} of ids from cursorId
  }

  async getRowIdSlice ({ cursorId, size, ...custom }) {
    // return a number {size} of ids from cursorId 
  }

  async getRowCount ({...custom }) {
    // return total numbers of rows
  }

  async getShingles ({ columnIds, rowIds, ...custom }) {
    // return Shingles for specified columns and rows
  }
  
  async store ({ index, buckets, data, ...custom }) {
    // store a batch of minhashes and bucket info 
  }
  
  async finalise ({ blocks, columns, rows, stamp, data }) {
    // ... finalise info lsh storage
    // return report object
  }
  
  static get limit () {
    // return permutation limit
  }
  
  static signature(value, index) {
    // return stringified value
  } 

  static ignore (bucketId) {
    // return whether this bucket is null
  }

  static format (bucketId, index) {
    // return formated bucketId to append to minhash
  }
}

module.exports = MyDataLsh
```
2. Compute your minhashes
```javascript
const MyDataLsh = require('./myDataLsh')
const { compare } = require('./myComparator')
const myDataLsh = new MyDataLsh(10, 10)

//...
  
  const size = 25 // size of blocks to be computed
  const report = await myDataLsh(custom, size)
  
  // compare your items minhash
  const similarity = compare(itemA.minHash, itemB.minHash)
// ...
```

## Running the tests

```
npm test
```

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/5app/lsh/tags). 

