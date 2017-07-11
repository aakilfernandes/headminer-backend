const mysql = require('promise-mysql')
const fs = require('fs')
const getSecret = require('./getSecret')

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
   });
 });

module.exports = pool
