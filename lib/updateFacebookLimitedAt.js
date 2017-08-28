const limited_at_path = require('./facebook_limited_at_path')
const fs = require('fs')

module.exports = function updateFacebookLimitedAt() {
  fs.writeFileSync(limited_at_path, new Date())
}
