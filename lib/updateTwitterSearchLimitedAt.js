const limited_at_path = require('./twitter_search_limited_at_path')
const fs = require('fs')

module.exports = function updateTwitterSearchLimitedAt() {
  fs.writeFileSync(limited_at_path, new Date())
}
