const connection = require('../lib/connection')
const _ = require('lodash')
const getQs = require('../lib/getQs')
const waterfall = require('promise-waterfall')


connection.query((`SELECT * FROM twitter_influencers`)).then((influencers) => {
  return connection.query(`
    SELECT twitter_statuses_urls.url_id, COUNT(twitter_statuses_urls.id)
    AS url_count FROM urls, twitter_statuses_urls
    WHERE urls.id = twitter_statuses_urls.url_id
    GROUP BY url_id HAVING url_count >= 100
    ORDER BY COUNT(twitter_statuses_urls.id)
    DESC, urls.twitter_influencified_at ASC LIMIT 1
  `).then((results) => {
    const url_id = results[0].url_id
    return connection.query(`
      SELECT * FROM twitter_statuses_urls WHERE url_id = ?
    `, [url_id]).then((statuses_urls) => {

      const status_ids = statuses_urls.map((statuses_url) => {
        return statuses_url.status_id
      })
      const select_status_ids_qs = getQs(status_ids.length)

      return connection.query(`
        SELECT user_id FROM twitter_statuses WHERE id IN (${select_status_ids_qs})
      `, status_ids).then((statuses) => {
        const user_ids = _.uniq(statuses.map((status) => {
          return status.user_id
        }))

        const select_user_ids_qs = getQs(user_ids.length)

        return connection.query(`
          SELECT * FROM twitter_users WHERE id IN (${select_user_ids_qs})
        `, user_ids).then((users) => {
          const inserts = []
          console.log('influencers.length', influencers.length)
          influencers.forEach((influencer, index) => {
            inserts.push(function insert() {
              console.log('index', index)
              return connection.query(`
                START TRANSACTION;
                SET @users_count := (
                  SELECT COUNT(id) FROM twitter_friendships
                  WHERE user_id IN (${select_user_ids_qs}) AND friend_id = ?
                  GROUP BY friend_id
                );
                SET @influence = @users_count / ?;
                INSERT IGNORE INTO
                  twitter_urls_influences(url_id, influencer_id, influence)
                  VALUES(?, ?, @influence)
                  ON DUPLICATE KEY UPDATE influence = @influence;
                COMMIT;
              `,
              user_ids.concat([
                influencer.id,
                influencer.followers_count,
                url_id,
                influencer.id,
              ])
            ).then((results) => {
              console.log(results)
            })
          })
        })
        return waterfall(inserts)
        })
      })
    })
  })
}).finally(() => {
  connection.end()
})
