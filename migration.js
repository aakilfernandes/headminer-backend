const migration = require('mysql-migrations')
const connection = require('./lib/connection')

migration.init(connection, __dirname + '/migrations')
