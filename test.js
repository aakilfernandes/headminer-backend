const mysqlQuery = require('./lib/mysqlQuery')

mysqlQuery('SELECT * FROM urls ORDER BY id DESC LIMIT 1').then((urls) => {
  console.log(new Date(urls[0].created_at).getTime())
})
