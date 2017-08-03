const request = require('request-promise')
const _ = require('lodash')
const twitter = require('./twitter')
const Bignumber = require('bignumber.js')
const Promise = require('bluebird')

const count = 100

module.exports = function getTwitterStatuses(q, max_id) {
  const statuses = []
  return twitter.get('search/tweets', {
    q , count, max_id
  }).then((results) => {
    statuses.push(...results.statuses)
    if (results.statuses.length < count) {
      return statuses
    }
    const next_max_id = new Bignumber(results.statuses[count - 1].id_str).plus(1).toString()
    return getTwitterStatuses(q, next_max_id).then((__statuses) => {
      statuses.push(...__statuses)
      return statuses
    })
  })
}
