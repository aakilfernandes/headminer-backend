const mysqlConnect = require('./mysqlConnect')
const delay = require('delay')

module.exports = function mysqlQuery() {
  const args = arguments
  return mysqlConnect().then((mysqlConnection) => {
    return mysqlConnection.query.apply(mysqlConnection, args).catch((error) => {
      if (error.code==='ER_LOCK_DEADLOCK' && error.errno===1213 && error.sqlState==='40001') {
        return delay(1000).then(() => {
          return mysqlConnection.query.apply(mysqlConnection, args)
        })
      }
      throw error
    })
  })
}
