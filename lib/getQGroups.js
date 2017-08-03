const _ = require('lodash')
const getQs = require('./getQs')

module.exports = function getQGroups(group_length, q_length, extra) {
  const qs = getQs(q_length)
  return _.fill(new Array(group_length), `(${qs}${extra || ''})`).join(',\r\n')
}
