const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')

mysqlQuery(`DELETE FROM jobs WHERE created_at < NOW() - INTERVAL 1 DAY`).finally(() => {
  return mysqlDisconnect()
})
