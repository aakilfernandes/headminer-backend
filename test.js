const endpoints = require('./lib/endpoints')
const mysqlDisconnect = require('./lib/mysqlDisconnect')

const started_at = Date.now()

endpoints.articles.handleAndCache({ page_index: 0 }).then(() => {
  console.log(Date.now() - started_at)
  return mysqlDisconnect()
})
