const _ = require('lodash')

module.exports = function getQs(length) {
  return _.fill(new Array(length), '?').join(',')
}
