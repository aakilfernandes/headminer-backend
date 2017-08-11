const request = require('request-promise')
const _ = require('lodash')
const twitter = require('./twitter')
const Bignumber = require('bignumber.js')
const Promise = require('bluebird')

const count = 100

module.exports = function getTwitterStatuses(q, since_id, max_id) {
  const statuses = []
  return twitter.get('search/tweets', {
    q , count, since_id, max_id
  }).then((results) => {
    statuses.push(...results.statuses.filter((status) => {
      return status.id_str !== since_id
    }))
    if (results.statuses.length < count) {
      return statuses
    }
    const next_max_id = new Bignumber(results.statuses[count - 1].id_str).sub(1).toString()
    return getTwitterStatuses(q, since_id, next_max_id).then((__statuses) => {
      statuses.push(...__statuses)
      return statuses
    })
  })
}
