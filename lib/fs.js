const Promise = require('bluebird')
const fs = require('fs')
Promise.promisifyAll(fs)

module.exports = fs
