const request = require('request-promise')
const connection = require('../lib/connection')
const getRedditPosts = require('../lib/getRedditPosts')
const getQGroups = require('../lib/getQGroups')
const urljs = require('url')
const _ = require('lodash')
const getQs = require('../lib/getQs')
const waterfall = require('promise-waterfall')
const updateApiLimitedAt = require('../lib/updateApiLimitedAt')
const fs = require('fs')
const getSecret = require('../lib/getSecret')

const proxies = _.shuffle(getSecret('proxies').split('\n'))
let proxy_index = 0

function fetchAndPush(url_pojo, queries, values) {
  const proxy = proxies[proxy_index]
  const proxyRequest = request.defaults({ proxy })
  return proxyRequest(`http://graph.facebook.com/?id=${url_pojo.url}`).then((body) => {
    queries.push(`
      UPDATE urls SET og_id = ?, facebook_share_count = ?, facebook_comment_count = ? WHERE id = ?;
      INSERT INTO facebook_snapshots(url_id, updated_time, share_count, comment_count)
        VALUES(?, ?, ?, ?);
    `)
    const og_pojo = JSON.parse(body)
    const og_id = og_pojo.og_object ? og_pojo.og_object.id : null
    const updated_time = og_pojo.og_object ? new Date(og_pojo.og_object.updated_time) : null
    values.push(
      og_id,
      og_pojo.share.share_count,
      og_pojo.share.comment_count,
      url_pojo.id,
      url_pojo.id,
      updated_time,
      og_pojo.share.share_count,
      og_pojo.share.comment_count
    )
  }, (error) => {
    if (error && error.statusCode === 403) {
      proxy_index += 1
      if (proxy_index >= proxies.length) {
        return updateApiLimitedAt('facebook').then(() => {
          throw error
        })
      }
      return fetchAndPush(url_pojo, queries, values)
    }
    throw error
  })
}

return connection.query(`
  SELECT urls.* FROM urls, domains
  WHERE urls.domain_id = domains.id
    AND domains.is_ignored = 0
  ORDER BY facebook_snapshot_added_at ASC, id ASC LIMIT 100;
`).then((url_pojos) => {
  const url_ids = _.map(url_pojos, 'id')
  const url_ids_qs = getQs(url_ids.length)
  return connection.query(`
    UPDATE urls SET facebook_snapshot_added_at = NOW() WHERE id IN (${url_ids_qs})
  `, url_ids).then(() => {
    const queries = []
    const values = []

    const wrappedFetchAndPushes = url_pojos.map((url_pojo) => {
      return () => {
        return fetchAndPush(url_pojo, queries, values)
      }
    })

    return waterfall(wrappedFetchAndPushes).then(() => {
      const query = queries.join('\r\n')
      return connection.query(query, values)
    }, (error) => {
      if (error && error.statusCode === 403) {
        const query = queries.join('\r\n')
        return connection.query(query, values).then(() => {
          throw error
        })
      }
      throw error
    })
  })
}).finally(() => {
  connection.end()
})
