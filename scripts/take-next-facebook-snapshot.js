const connection = require('../lib/connection')
const request = require('request-promise')
const parseRss = require('../lib/parseRss')

let article

connection.query('SELECT * FROM articles ORDER BY facebook_snapshot_taken_at ASC LIMIT 1').then((articles) => {
  return articles[0]
}).then((_article) => {
  article = _article
}).then(() => {
  return connection.query('UPDATE articles SET facebook_snapshot_taken_at = NOW() WHERE id = ?', [article.id])
}).then(() => {
  return request(`http://graph.facebook.com/?id=${article.url}`)
}).then((json) => {
  return JSON.parse(json)
}).then((pojo) => {
  const timestamp = pojo.og_object ? new Date(pojo.og_object.updated_time) : null
  return connection.query('INSERT INTO facebook_snapshots(article_id, updated_time, comment_count, share_count) VALUES(?, ?, ?, ?)', [
    article.id, timestamp, pojo.share.comment_count, pojo.share.share_count
  ])
}).then(() => {
  process.exit()
})
