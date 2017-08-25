const connection = require('./lib/connection')

connection.query('SELECT * FROM urls WHERE id = ?', [253]).then((urls2) => {
  return connection.query('SELECT * FROM urls WHERE id = ?', [253]).then((urls) => {
    const url = urls[0]
    console.log(url)
  })
})
