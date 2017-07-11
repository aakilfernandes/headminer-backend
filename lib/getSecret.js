const fs = require('fs')

module.exports = function getSecret(file){
  return fs.readFileSync(`${__dirname}/../secrets/${file}`, 'utf8').replace(/(\n|\r)+$/, '')
}
