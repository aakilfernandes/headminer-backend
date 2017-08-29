const connection = require('../lib/connection')
const _ = require('lodash')
const getQs = require('../lib/getQs')
const waterfall = require('promise-waterfall')

const user_sample_size = 1000

connection.query(
  `SELECT * FROM twitter_influencers WHERE is_ignored = 0 ORDER BY id`
).then((influencers) => {
  if (influencers.length === 0) {
    return
  }
  return connection.query(`
    SELECT urls.* FROM urls, domains
    WHERE urls.domain_id = domains.id
      AND domains.is_ignored = 0
      AND urls.twitter_statuses_count > 100
    ORDER BY twitter_influencified_at ASC
    LIMIT 100;
  `).then((url_pojos) => {

    const url_ids = _.map(url_pojos, 'id')
    const url_ids_qs = getQs(url_ids.length)

    return connection.query(`
      UPDATE urls SET twitter_influencified_at = NOW() WHERE id IN (${url_ids_qs})
    `, url_ids).then(() => {
      const influencifies = url_pojos.map((url_pojo) => {
        const multiplier = Math.max(1, url_pojo.twitter_statuses_count / user_sample_size)
        return function influencify() {
          return connection.query(
            `SELECT twitter_users.*
            FROM twitter_users, twitter_statuses, twitter_statuses_urls
            WHERE twitter_statuses_urls.url_id = ?
              AND twitter_statuses.id = twitter_statuses_urls.status_id
              AND twitter_users.id = twitter_statuses.user_id
            ORDER BY RAND() LIMIT ?`,
            [url_pojo.id, user_sample_size]
          ).then((users) => {

            const user_ids = _.map(users, 'id')
            const select_user_ids_qs = getQs(user_ids.length)
            const queries = []
            const values = []

            influencers.forEach((influencer, index) => {
              queries.push(`
                START TRANSACTION;
                SET @sample_influence := (
                  SELECT COUNT(id) FROM twitter_friendships
                  WHERE user_id IN (${select_user_ids_qs}) AND friend_id = ?
                );
                INSERT IGNORE INTO
                  twitter_urls_influences(url_id, influencer_id, influence)
                  VALUES(?, ?, @sample_influence)
                  ON DUPLICATE KEY UPDATE influence = ROUND(@sample_influence * ?);
                COMMIT;
              `)
              values.push(...user_ids)
              values.push(
                influencer.id,
                url_pojo.id,
                influencer.id,
                multiplier
              )
            })
            const query = queries.join('\r\n')
            return connection.query(query, values)
          })
        }
      })

      return waterfall(influencifies)
    })


  })
}).finally(() => {
  connection.end()
})
