const getTwitterStatuses = require('../lib/getTwitterStatuses')
const connection = require('../lib/connection')
const getQGroups = require('../lib/getQGroups')
const getQs = require('../lib/getQs')
const fs = require('fs')
const updateApiLimitedAt = require('../lib/updateApiLimitedAt')
const _ = require('lodash')
const waterfall = require('promise-waterfall')

connection.query(`
  SELECT urls.* FROM urls, domains
  WHERE urls.created_at >= NOW() - INTERVAL 2 DAY
    AND urls.domain_id = domains.id
    AND domains.is_ignored = 0
  ORDER BY urls.twitter_statuses_added_at ASC, urls.id ASC
  LIMIT 100;
  `
).then((url_pojos) => {

  const url_ids = _.map(url_pojos, 'id')
  const url_ids_qs = getQs(url_ids.length)

  return connection.query(`
    UPDATE urls SET twitter_statuses_added_at = NOW() WHERE id IN (${url_ids_qs})
  `, url_ids).then(() => {
    const fetchAndUpdates = url_pojos.map((url_pojo) => {
      return function fetchAndUpdate() {
        return getTwitterStatuses(`url:${url_pojo.url}`, url_pojo.last_twitter_status_id).then((statuses) => {

          const insert_users_q_groups = getQGroups(statuses.length, 3)
          const insert_statuses_q_groups = getQGroups(statuses.length, 4)
          const insert_statuses_urls_q_groups = getQGroups(statuses.length, 2)

          const insert_users_values = []
          const insert_statuses_values = []
          const insert_statuses_urls_values = []

          statuses.forEach((status) => {
            insert_users_values.push(
              status.user.id_str,
              status.user.friends_count,
              status.user.followers_count
            )
            insert_statuses_values.push(
              status.id_str,
              new Date(status.created_at),
              status.user.id_str,
              status.text
            )
            insert_statuses_urls_values.push(
              status.id_str,
              url_pojo.id
            )
          })



          const old_twitter_statuses_count = url_pojo.twitter_statuses_count || 0
          const new_twitter_statuses_count =
            url_pojo.last_twitter_status_id ?
              (old_twitter_statuses_count + statuses.length)
              : statuses.length

          const last_twitter_status_id = statuses.length > 0 ? statuses[0].id_str : url_pojo.last_twitter_status_id

          const all_values = [new_twitter_statuses_count, last_twitter_status_id, url_pojo.id]
            .concat(insert_users_values)
            .concat(insert_statuses_values)
            .concat(insert_statuses_urls_values)

          const inserts_query = statuses.length === 0 ? '' :
            `
            INSERT IGNORE INTO twitter_users(id, friends_count, followers_count)
            VALUES ${insert_users_q_groups};
            INSERT IGNORE INTO twitter_statuses(id, created_at, user_id, text)
            VALUES ${insert_statuses_q_groups};
            INSERT INTO twitter_statuses_urls(status_id, url_id)
            VALUES ${insert_statuses_urls_q_groups};
            `

          return connection.query(`
            UPDATE urls SET twitter_statuses_count = ?, last_twitter_status_id = ? WHERE id = ?;
            ${inserts_query}
            `,
            all_values
          )
        })
      }
    })

    return waterfall(fetchAndUpdates)
  })

}).catch((error) => {
  if (error[0] && error[0].code === 88) {
    return updateApiLimitedAt('twitter-search').then(() => {
      throw error
    })
  }
  throw error
}).finally(() => {
  connection.end()
})
