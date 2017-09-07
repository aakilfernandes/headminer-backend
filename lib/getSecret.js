const fs = require('./fs')

module.exports = function getSecret(file){
  return fs.readFileAsync(`${__dirname}/../secrets/${file}`, 'utf8').then((secret) => {
    return secret.replace(/(\n|\r)+$/, '')
  })
}
