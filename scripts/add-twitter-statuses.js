const getTwitterStatuses = require('../lib/getTwitterStatuses')
const connection = require('../lib/connection')
const getQGroups = require('../lib/getQGroups')

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
    const insert_statuses_q_groups = getQGroups(statuses.length, 4)
    const insert_users_values = []
    const insert_statuses_values = []

    statuses.forEach((status) => {
      insert_users_values.push(status.user.id_str)
      insert_statuses_values.push(
        status.id_str,
        new Date(status.created_at),
        status.user.id_str,
        url_pojo.id
      )
    })

    return connection.query(`
      INSERT IGNORE INTO twitter_users(id)
      VALUES ${insert_users_q_groups};
      INSERT IGNORE INTO twitter_statuses(id, created_at, user_id, url_id)
      VALUES ${insert_statuses_q_groups};
      `,
      insert_users_values.concat(insert_statuses_values)
    )
  })
}).finally(() => {
  connection.end()
})