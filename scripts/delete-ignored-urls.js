const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')

mysqlQuery(`
  DELETE urls FROM urls, domains
  WHERE urls.domain_id = domains.id
    AND domains.is_ignored = 1
`).then(() => {
  return mysqlDisconnect()
})
