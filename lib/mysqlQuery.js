const mysqlConnect = require('./mysqlConnect')
const delay = require('delay')
const _ = require('lodash')

module.exports = function mysqlQuery() {
  const args = arguments
  return mysqlConnect().then((mysqlConnection) => {
    return mysqlConnection.query.apply(mysqlConnection, args).then((results) => {
      crawl(results, (thing, key, value) => {
        if (key.substr(-3) === '_at') {
          const at_utc = new Date(value)
          const timezone_offset = (new Date).getTimezoneOffset() * 60 * 1000
          thing[key] = new Date(at_utc - timezone_offset)
        }
      })
      return results
    }).catch((error) => {
      if (error.code==='ER_LOCK_DEADLOCK' && error.errno===1213 && error.sqlState==='40001') {
        return delay(1000).then(() => {
          return mysqlQuery.apply(null, args)
        })
      }
      throw error
    })
  })
}

function crawl(thing, func) {
  if (Array.isArray(thing)) {
    thing.forEach((thang) => {
      crawl(thang, func)
    })
    return
  } else {
    _.forEach(thing, (value, key) => {
      func(thing, key, value)
    })
  }
}
