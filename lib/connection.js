const mysql = require('promise-mysql')
const fs = require('fs')
const getSecret = require('./getSecret')
const delay = require('delay')

const pool = mysql.createPool({
  host     : '104.131.35.33',
  user     : 'root',
  password : getSecret('db_test'),
  database : 'main',
  supportBigNumbers: true,
  multipleStatements: true
})

const logFilePath = `${__dirname}/../workspace/mysql.log`

pool.on('connection', function(connection) {
  connection.on('enqueue', function(sequence) {
    // if (sequence instanceof mysql.Sequence.Query) {
    if ('Query' === sequence.constructor.name) {
      fs.writeFileSync(logFilePath, `${sequence.sql}\r\n`)
    }
  })
})

const query = pool.query

pool.query = function () {
  const args = arguments
  return query.apply(this, args).catch((error) => {
    if (error.code==='ER_LOCK_DEADLOCK' && error.errno===1213 && error.sqlState==='40001') {
      return delay(1000).then(() => {
        return pool.query.apply(this, args)
      })
    }
    throw error
  })
}

module.exports = pool
