const getTwitterStatuses = require('../lib/getTwitterStatuses')
const connection = require('../lib/connection')
const getQGroups = require('../lib/getQGroups')
const fs = require('fs')
const updateTwitterSearchLimitedAt = require('../lib/updateTwitterSearchLimitedAt')

connection.query(`
  START TRANSACTION;
  SET @url_id := (
    SELECT urls.id
    FROM urls, domains
    WHERE urls.domain_id = domains.id AND domains.is_ignored = 0
    ORDER BY twitter_statuses_added_at ASC
    LIMIT 1
  );
  UPDATE urls SET twitter_statuses_added_at = NOW() WHERE id = @url_id;
  SELECT * FROM urls WHERE id = @url_id;
  SELECT * FROM twitter_statuses_urls WHERE url_id = @url_id ORDER BY status_id DESC LIMIT 1;
  COMMIT;
  `
).then((results) => {

  const url_pojos = results[3]
  const status_urls_pojos = results[4]
  if (url_pojos.length === 0) {
    return
  }

  const url_pojo = url_pojos[0]
  console.log(url_pojo.id)

  const since_id = status_urls_pojos.length > 0 ? status_urls_pojos[0].status_id : 0
  console.log(since_id)

  return getTwitterStatuses(`url:${url_pojo.url}`, since_id).then((statuses) => {
    console.log(statuses.length)

    const insert_users_q_groups = getQGroups(statuses.length, 3)
    const insert_statuses_q_groups = getQGroups(statuses.length, 3)
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
        status.user.id_str
      )
      insert_statuses_urls_values.push(
        status.id_str,
        url_pojo.id
      )
    })

    const old_twitter_statuses_count = url_pojo.twitter_statuses_count || 0
    const new_twitter_statuses_count = old_twitter_statuses_count + statuses.length

    console.log(new_twitter_statuses_count)

    const all_values = [new_twitter_statuses_count, url_pojo.id]
      .concat(insert_users_values)
      .concat(insert_statuses_values)
      .concat(insert_statuses_urls_values)

    const inserts_query = statuses.length === 0 ? '' :
      `
      INSERT IGNORE INTO twitter_users(id, friends_count, followers_count)
      VALUES ${insert_users_q_groups};
      INSERT IGNORE INTO twitter_statuses(id, created_at, user_id)
      VALUES ${insert_statuses_q_groups};
      INSERT INTO twitter_statuses_urls(status_id, url_id)
      VALUES ${insert_statuses_urls_q_groups};
      `

    return connection.query(`
      UPDATE urls SET twitter_statuses_count = ? WHERE id = ?;
      ${inserts_query}
      `,
      all_values
    )
  })
}).catch((error) => {
  if (error[0] && error[0].code === 88) {
    updateTwitterSearchLimitedAt()
  }
  throw error
}).finally(() => {
  connection.end()
})
