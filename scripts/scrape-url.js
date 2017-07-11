const connection = require('../lib/connection')
const request = require('request-promise')
const parseHtml = require('../lib/parseHtml')
const _ = require('lodash')
const getQGroups = require('../lib/getQGroups')
const parseDomain = require('parse-domain')

const count = 1
let hostname_pojos

connection.query('SELECT * FROM publisher_hostnames').then((_hostname_pojos) => {
  hostname_pojos = _hostname_pojos
}).then(() => {
  return connection.query(`
    START TRANSACTION;
    SELECT * FROM urls WHERE scraped_at IS NULL ORDER BY id ASC LIMIT ?;
    UPDATE urls SET scraped_at = NOW() WHERE scraped_at IS NULL ORDER BY id ASC LIMIT ?;
    COMMIT;
    `,
    [count, count]
  )
}).then((results) => {
  const url_pojo = results[1][0]
  if (!url_pojo) {
    return
  }
  return request(url_pojo.url, {
    resolveWithFullResponse: true,
    timeout: 2000
  }).then((response) => {
    const parsed = parseHtml(response.body)
    const urls = _.uniq([parsed.meta['og:url'], parsed.links.canonical, response.request.uri].filter((url) => {
      return typeof url === 'string'
    }))
    const title = parsed.meta['og:title'] || parsed.title
    const image = parsed.meta['og:image']
    const canonical_url = urls[0]
    const parsed_canonical_url = parseDomain(canonical_url)
    const hostname = `${parsed_canonical_url.domain}.${parsed_canonical_url.tld}`
    const hostname_pojo = _.find(hostname_pojos, (_hostname_pojo) => {
      return _hostname_pojo.hostname === hostname
    })
    const urlQGroups = getQGroups(urls.length, 1)
    return connection.query(`INSERT IGNORE INTO urls(url) VALUES ${urlQGroups}`, urls).then(() => {
      if (canonical_url === url_pojo.url) {
        return connection.query('UPDATE urls SET canonical_url_id = ? WHERE id = ?', [url_pojo.id, url_pojo.id]).then(() => {
          return connection.query('INSERT INTO articles(publisher_id, url_id, title, image) VALUES(?, ?, ?, ?)', [
            hostname_pojo && hostname_pojo.publisher_id, url_pojo.id, title, image
          ])
        })
      }
      return connection.query(`SELECT id FROM urls WHERE url = ?`, [canonical_url]).then((results) => {
        const canonical_url_id = results[0].id
        return connection.query(`UPDATE urls SET canonical_url_id = ? WHERE id = ?`, [canonical_url_id, url_pojo.id])
      })
    })
  })
}).finally(() => {
  connection.end()
})
