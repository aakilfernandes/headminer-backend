const limited_at_path = require('./twitter_friend_ids_limited_at_path')
const fs = require('fs')

module.exports = function updateTwitterFriendIdsLimitedAt() {
  fs.writeFileSync(limited_at_path, new Date())
}
