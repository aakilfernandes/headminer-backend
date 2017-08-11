const limited_at_path = require('./twitter_friend_ids_limited_at_path')
const fs = require('fs')

module.exports = function getTimeSinceTwitterFriendIdsLimitedAt() {
  if (!fs.existsSync(limited_at_path)) {
    return null
  }
  const limited_at = fs.readFileSync(limited_at_path, 'utf8')
  return new Date() - new Date(limited_at)
}
