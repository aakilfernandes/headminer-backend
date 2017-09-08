const mysqlConnect = require('./mysqlConnect')

module.exports = function mysqlDisconnect() {
  return mysqlConnect().then((connection) => {
    connection.end()
  })
}
