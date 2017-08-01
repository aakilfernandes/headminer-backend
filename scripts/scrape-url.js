const connection = require('../lib/connection')
const request = require('request-promise')
const parseHtml = require('../lib/parseHtml')
const _ = require('lodash')
const getQGroups = require('../lib/getQGroups')
const parseDomain = require('parse-domain')

let hostname_pojos

return connection.query(`
  START TRANSACTION;
  SET @url_id := (
    SELECT urls.id FROM domains, urls
    WHERE urls.scraped_at IS NULL AND domains.id = urls.domain_id AND domains.is_ignored = FALSE
    LIMIT 1
  );
  SELECT * FROM urls WHERE id = @url_id;
  UPDATE urls SET scraped_at = NOW() WHERE id = @url_id;
  COMMIT;
  `
).then((results) => {
  const url_pojo = results[2][0]
  if (!url_pojo) {
    return
  }
  return request(url_pojo.url, {
    resolveWithFullResponse: true,
    timeout: 5000
  }).then((response) => {

    const parsed = parseHtml(response.body)
    const urls = _.uniq([parsed.meta['og:url'], parsed.links.canonical, response.request.uri, url_pojo.url].filter((url) => {
      return typeof url === 'string'
    })).map((url) => {
      const protocol = url_pojo.url.split('://')[0]
      if (url.indexOf('//') === 0) {
        return url.replace('//', `${protocol}://`)
      }
      return url
    })

    const title = parsed.meta['og:title'] || parsed.title
    const author = parsed.meta['article:author'] || parsed.meta.author
    const description = parsed.meta['og:description'] || parsed.description
    const image = parsed.meta['og:image']
    const canonical_url = urls[0]
    const parsed_canonical_url = parseDomain(canonical_url)
    if (!parsed_canonical_url) {
      throw new Error(`Could not parse canonical url ${canonical_url}`)
    }

    return connection.query(
      `INSERT IGNORE INTO urls(url) VALUE (?)`, [canonical_url]
    ).then(() => {
      return connection.query(
        `UPDATE urls SET canonical_url_id = (SELECT id WHERE url = ?) WHERE id = ?`,
        [canonical_url, url_pojo.id]
      )
    }).then(() => {
      return connection.query('INSERT INTO articles(url_id, title, author, description, image) VALUES(?, ?, ?, ?, ?)', [
        url_pojo.id,
        title,
        author,
        description,
        image
      ])
    })
  })
}).finally(() => {
  connection.end()
})
