const connection = require('../lib/connection')
const request = require('request-promise')
const parseRss = require('../lib/parseRss')
const waterfall = require('promise-waterfall')

let feed

connection.query('SELECT * FROM feeds WHERE publisher_id = 3 ORDER BY scraped_at ASC LIMIT 1').then((feeds) => {
  return feeds[0]
}).then((_feed) => {
  feed = _feed
}).then(() => {
  return connection.query('UPDATE feeds SET scraped_at = NOW() WHERE id = ?', [feed.id])
}).then(() => {
  return request(feed.url)
}).then((rss) => {
  return parseRss(rss)
}).then((parsed) => {
  const inserts = parsed.feed.entries.map((entry) => {
    return () => {
      return connection.query('SELECT COUNT(id) FROM feed_entries WHERE publisher_id = ? AND guid = ?', [
        feed.publisher_id, entry.guid
      ]).then((results) => {
        const count = results[0]['COUNT(id)']
        if (count !== 0) {
          return
        } else {
          return connection.query('INSERT INTO feed_entries(publisher_id, guid, link) VALUES(?, ?, ?)', [
            feed.publisher_id, entry.guid, entry.link
          ])
        }
      })
    }
  })
  return waterfall(inserts)
}).then(() => {
  process.exit()
})
