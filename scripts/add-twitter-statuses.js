const getTwitterStatuses = require('../lib/getTwitterStatuses')
const connection = require('../lib/connection')
const getQGroups = require('../lib/getQGroups')
const fs = require('fs')

const twitter_search_rate_limited_at_file = `${__dirname}/../workspace/twitter-search-rate-limited-at`

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
  COMMIT;
  `
).then((results) => {
  const url_pojos = results[3]
  if (url_pojos.length === 0) {
    return
  }

  const url_pojo = url_pojos[0]
  console.log(url_pojo.id)

  return getTwitterStatuses(`url:${url_pojo.url}`).then((statuses) => {
    console.log(statuses.length)
    if (statuses.length === 0) {
      return
    }

    const insert_users_q_groups = getQGroups(statuses.length, 1)
    const insert_statuses_q_groups = getQGroups(statuses.length, 3)
    const insert_statuses_urls_q_groups = getQGroups(statuses.length, 2)

    const insert_users_values = []
    const insert_statuses_values = []
    const insert_statuses_urls_values = []

    statuses.forEach((status) => {
      insert_users_values.push(status.user.id_str)
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

    const all_values = []
      .concat(insert_users_values)
      .concat(insert_statuses_values)
      .concat(insert_statuses_urls_values)

    return connection.query(`
      INSERT IGNORE INTO twitter_users(id)
      VALUES ${insert_users_q_groups};
      INSERT IGNORE INTO twitter_statuses(id, created_at, user_id)
      VALUES ${insert_statuses_q_groups};
      INSERT INTO twitter_statuses_urls(status_id, url_id)
      VALUES ${insert_statuses_urls_q_groups};
      `,
      all_values
    )
  })
}).catch((error) => {
  if (error[0] && error[0].code === 88) {
    fs.writeFileSync(twitter_search_rate_limited_at_file, new Date())
  }
  throw error
}).finally(() => {
  connection.end()
})
