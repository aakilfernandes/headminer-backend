const connection = require('../lib/connection')
const request = require('request-promise')
const parseRss = require('../lib/parseRss')

const count = 1

connection.query(  `
  START TRANSACTION;
  SET @url_id := (SELECT id FROM urls ORDER BY facebook_snapshot_taken_at ASC, id ASC LIMIT 1);
  SELECT * FROM urls WHERE id = @url_id;
  UPDATE urls SET facebook_snapshot_taken_at = NOW() WHERE id = @url_id;
  COMMIT;`,
  [count, count]
).then((result) => {
  const url_pojo = result[2][0]
  return request(`http://graph.facebook.com/?id=${url_pojo.url}`).then((body) => {
    const og_pojo = JSON.parse(body)
    const og_id = og_pojo.og_object ? og_pojo.og_object.id : null
    const updated_time = og_pojo.og_object ? new Date(og_pojo.og_object.updated_time) : null
    return connection.query('INSERT INTO facebook_snapshots(url_id, og_id, updated_time, comment_count, share_count) VALUES(?, ?, ?, ?, ?)', [
      url_pojo.id,
      og_id,
      updated_time,
      og_pojo.share.comment_count,
      og_pojo.share.share_count
    ])
  })
}).finally(() => {
  connection.end()
})
