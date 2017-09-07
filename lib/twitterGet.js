const getTwitter = require('./getTwitter')
const Promise = require('bluebird')
const _ = require('lodash')

module.exports = function twitterGet() {
  const args = _.toArray(arguments)
  return getTwitter().then((twitter) => {
    return new Promise((resolve, reject) => {
      args.push((err, results) => {
        if (err) {
          reject(err)
        } else {
          resolve(results)
        }
      })
      twitter.get.apply(twitter, args)
    })
  })
}
