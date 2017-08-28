const request = require('request-promise')
const connection = require('../lib/connection')
const getRedditPosts = require('../lib/getRedditPosts')
const getQGroups = require('../lib/getQGroups')
const urljs = require('url')
const _ = require('lodash')
const getQs = require('../lib/getQs')
const waterfall = require('promise-waterfall')

return connection.query(`
  SELECT urls.* FROM urls, domains
  WHERE urls.domain_id = domains.id
    AND domains.is_ignored = 0
  ORDER BY facebook_snapshot_added_at ASC, id ASC LIMIT 10;
`).then((url_pojos) => {
  const url_ids = _.map(url_pojos, 'id')
  const url_ids_qs = getQs(url_ids.length)
  return connection.query(`
    UPDATE urls SET facebook_snapshot_added_at = NOW() WHERE id IN (${url_ids_qs})
  `, url_ids).then(() => {
    const queries = []
    const values = []

    const fetches = url_pojos.map((url_pojo) => {
      queries.push(`
        UPDATE urls SET facebook_share_count = ?, facebook_comment_count = ? WHERE id = ?;
        INSERT INTO facebook_snapshots(url_id, og_id, updated_time, share_count, comment_count)
          VALUES(?, ?, ?, ?, ?);
      `)
      return function fetch() {
        return request(`http://graph.facebook.com/?id=${url_pojo.url}`).then((body) => {
          const og_pojo = JSON.parse(body)
          const og_id = og_pojo.og_object ? og_pojo.og_object.id : null
          const updated_time = og_pojo.og_object ? new Date(og_pojo.og_object.updated_time) : null
          values.push(
            og_pojo.share.share_count,
            og_pojo.share.comment_count,
            url_pojo.id,
            url_pojo.id,
            og_id,
            updated_time,
            og_pojo.share.share_count,
            og_pojo.share.comment_count
          )
        })
      }
    })

    return waterfall(fetches).then(() => {
      const query = queries.join('\r\n')
      return connection.query(query, values)
    })
  })
}).finally(() => {
  connection.end()
})
