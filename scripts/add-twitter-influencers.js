const connection = require('../lib/connection')
const getQs = require('../lib/getQs')
const Promise = require('bluebird')
const waterfall = require('promise-waterfall')
const twitter = require('../lib/twitter')
const emojiStrip = require('emoji-strip')
const _ = require('lodash')

return connection.query(`
  SELECT friend_id, count(id)
  FROM twitter_friendships
  GROUP BY friend_id
  ORDER BY count(id) DESC
  LIMIT 900
`).then((friendships) => {

  const get_and_inserts = friendships.map((friendship) => {

    const users_count = friendship['count(id)']

    return function get_and_insert() {
      return twitter.get('users/show', { user_id: friendship.friend_id }).then((user) => {
        return connection.query(`
          INSERT IGNORE INTO twitter_influencers
          (id, name, screen_name, description, followers_count, profile_image_url, users_count)
          VALUES(?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          description = ?, followers_count = ?, profile_image_url = ?, users_count = ?;
        `, [
          user.id_str,
          emojiStrip(user.name),
          user.screen_name,
          user.description,
          user.followers_count,
          user.profile_image_url_https,
          users_count,
          user.description,
          user.followers_count,
          user.profile_image_url_https,
          users_count
        ])
      })
    }
  })
  return waterfall(get_and_inserts)
}).finally(() => {
  connection.end()
})
