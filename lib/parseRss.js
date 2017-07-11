const Promise = require('bluebird')
const rssParser = require('rss-parser')

module.exports = function(rss) {
  return new Promise((resolve, reject) => {
    rssParser.parseString(rss, (err, parsed) => {
      if (err)
        reject(err)
      else
        resolve(parsed)
    })
  })
}
