const connection = require('../lib/connection')
const request = require('request-promise')
const Promise = require('bluebird')
const validUrl = require('valid-url')
const htmlparser = require('htmlparser2')
const _ = require('lodash')


let feed_entry
let parsed

connection.query('SELECT * FROM feed_entries WHERE scraped_at IS NULL AND publisher_id = 3 ORDER BY id ASC LIMIT 1').then((feed_entries) => {
  feed_entry = feed_entries[0]
}).then(() => {
  return connection.query('UPDATE feed_entries SET scraped_at = NOW() WHERE id = ?', [feed_entry.id])
}).then(() => {
  return request(feed_entry.link)
}).then((html) => {
  parsed = parseHtml(html)
}).then((html) => {
  return connection.query('INSERT INTO articles(publisher_id, title, image) VALUES(?, ?, ?)', [
    feed_entry.publisher_id, parsed.meta['og:title'], parsed.meta['og:url']
  ])
}).then((result) => {

  const urls = _.uniq([
    feed_entry.link,
    parsed.meta['og:url'],
    parsed.links.canonical,
    parsed.links.alternative
  ].filter((url) => {
    return url && validUrl.isUri(url)
  }))

  const valuesQuery = _.fill(new Array(urls.length), '(?, ?)').join(', ')
  const values = []

  urls.forEach((url) => {
    values.push(result.insertId, url)
  })

  return connection.query(`INSERT INTO article_urls(article_id, url) VALUES ${valuesQuery}`, values)
}).then(() => {
  process.exit()
})

function parseHtml(html) {
  const parsed = {
    links: {},
    meta: {}
  }
  const parser = new htmlparser.Parser({
    onopentag: (name, attribs) => {
      if (name === "link" && attribs.rel && attribs.href) {
        parsed.links[attribs.rel] = attribs.href
      }
      if (name === "meta" && attribs.property && attribs.content) {
        parsed.meta[attribs.property] = attribs.content
      }
    }
  }, {
    decodeEntities: true
  })
  parser.write(html)
  return parsed
}
