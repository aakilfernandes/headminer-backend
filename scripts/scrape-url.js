const connection = require('../lib/connection')
const request = require('request-promise')
const parseHtml = require('../lib/parseHtml')
const _ = require('lodash')
const getQGroups = require('../lib/getQGroups')
const urljs = require('url')

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
  console.log(url_pojo.id)
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
    const canonical_url_domain = urljs.parse(canonical_url).hostname

    console.log(canonical_url)
    console.log(canonical_url_domain)

    return connection.query(`
      INSERT IGNORE INTO domains(domain) VALUE (?);
      INSERT IGNORE INTO urls(domain_id, url) VALUE ((SELECT id FROM domains WHERE domains.domain = ?), ?);
      SET @canonical_url_id := (SELECT id FROM urls WHERE url = ? LIMIT 1);
      UPDATE urls SET canonical_url_id = @canonical_url_id WHERE id = ?;
      INSERT INTO articles(url_id, title, author, description, image) VALUES(?, ?, ?, ?, ?);
    `, [
      canonical_url_domain,
      canonical_url_domain,
      canonical_url,
      canonical_url, url_pojo.id,
      url_pojo.id, title, author, description, image
    ])
  })
}).finally(() => {
  connection.end()
})
