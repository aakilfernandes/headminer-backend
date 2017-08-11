const twitter = require('../lib/twitter')
const connection = require('../lib/connection')
const request = require('request-promise')
const waterfall = require('promise-waterfall')
const fs = require('fs')
const _ = require('lodash')
const getQGroups = require('../lib/getQGroups')
const updateTwitterFriendIdsLimitedAt = require('../lib/updateTwitterFriendIdsLimitedAt')

const max_friend_count = 2000

return connection.query(`
  START TRANSACTION;
  SET @user_id := (SELECT id FROM twitter_users WHERE friends_count <= ? ORDER BY friends_taken_at ASC LIMIT 1);
  SELECT * FROM twitter_users WHERE id = @user_id;
  UPDATE twitter_users SET friends_taken_at = NOW() WHERE id = @user_id;
  COMMIT;
`, [
  max_friend_count
]).then((result) => {
  const user = result[2][0]
  console.log(user.id)
  return twitter.get('friends/ids', {
    count: max_friend_count,
    user_id: user.id,
    stringify_ids: true
  }).then((result) => {
    const friend_ids = result.ids
    const insert_friendships_qs = getQGroups(friend_ids.length, 2)
    const insert_friendships_values = []

    console.log(friend_ids.length)

    friend_ids.forEach((friend_id) => {
      return insert_friendships_values.push(user.id, friend_id)
    })

    return connection.query(
      `INSERT IGNORE INTO twitter_friendships(user_id, friend_id) VALUES ${insert_friendships_qs}`,
      insert_friendships_values
    )

  })
}).catch((error) => {
  if (error[0] && error[0].code === 88) {
    updateTwitterFriendIdsLimitedAt()
  }
  throw error
}).finally(() => {
  connection.end()
})
