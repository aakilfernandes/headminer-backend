const mysql = require('promise-mysql')
const fs = require('./fs')
const getSecret = require('./getSecret')
const Promise = require('bluebird')

const logFilePath = `${__dirname}/../workspace/mysql.log`
let mysqlConnection

module.exports = function mysqlConnect() {

  return Promise.resolve().then(() => {
    if (mysqlConnection) {
      return mysqlConnection
    }
    return getSecret('db_test').then((password) => {

      if (mysqlConnection) {
        return mysqlConnection
      }

      const pool = mysql.createPool({
        host     : '104.131.35.33',
        user     : 'root',
        password : password,
        database : 'main',
        supportBigNumbers: true,
        multipleStatements: true
      })

      pool.on('connection', function(connection) {
        connection.on('enqueue', function(sequence) {
          if ('Query' === sequence.constructor.name) {
            fs.writeFileAsync(logFilePath, `${sequence.sql}\r\n`)
          }
        })
      })

      mysqlConnection = pool

      return pool

    })
  })
}
