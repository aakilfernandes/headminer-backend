const twitter = require('../lib/twitter')
const connection = require('../lib/connection')
const request = require('request-promise')
const waterfall = require('promise-waterfall')
const fs = require('fs')
const _ = require('lodash')
const getQGroups = require('../lib/getQGroups')

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
  return twitter.get('friends/ids', {
    count: max_friend_count,
    user_id: user.id,
    stringify_ids: true
  }).then((result) => {
    const friend_ids = result.ids
    const insert_relationship_qs = getQGroups(friend_ids.length, 2)
    const insert_relationship_values = []

    friend_ids.forEach((friend_id) => {
      return insert_relationship_values.push(user.id, friend_id)
    })

    return connection.query(
      `INSERT IGNORE INTO twitter_friendships(user_id, friend_id) VALUES ${insert_relationship_qs}`,
      insert_relationship_values
    )

  })
}).finally(() => {
  connection.end()
})
