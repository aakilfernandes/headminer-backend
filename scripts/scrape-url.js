const mysqlQuery = require('../lib/mysqlQuery')
const request = require('request-promise')
const parseHtml = require('../lib/parseHtml')
const _ = require('lodash')
const getQGroups = require('../lib/getQGroups')
const urljs = require('url')
const JSDOM = require('jsdom').JSDOM

let hostname_pojos

return mysqlQuery(`
  START TRANSACTION;
  SET @url_id := (
    SELECT urls.id FROM domains, urls
      WHERE
        domains.id = urls.domain_id
        AND domains.is_ignored = FALSE
        AND urls.article_id IS NULL
      ORDER BY scraped_at ASC
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

    let special_title = null

    if (url_pojo.domain_id === 429) {
      const jsdom = new JSDOM(response.body)
      special_title = jsdom.window.document.querySelector('.headline').textContent
    }

    const title = special_title || parsed.meta['og:title'] || parsed.title
    const author = parsed.meta['article:author'] || parsed.meta.author
    const description = parsed.meta['og:description'] || parsed.description
    const image = parsed.meta['og:image']
    const canonical_url = urls[0]
    const canonical_url_domain = urljs.parse(canonical_url).hostname

    let article_promise

    if (url_pojo.article_id === null) {
      article_promise = mysqlQuery(`
        INSERT INTO articles(title, author, description, image) VALUES (?, ?, ?, ?);
      `, [
        title,
        author,
        description,
        image
      ])
    } else {
      article_promise = mysqlQuery(`
        UPDATE articles SET title = ?, author = ?, description = ?, image = ? where id = ?
      `, [
        title,
        author,
        description,
        image,
        url_pojo.article_id
      ])
    }

    return article_promise.then((results) => {
      const article_id = url_pojo.article_id ? url_pojo.article_id : results.insertId
      console.log(article_id)
      return mysqlQuery(`
        START TRANSACTION;
        INSERT IGNORE INTO domains(domain) VALUE (?);
        INSERT IGNORE INTO urls(domain_id, url) VALUE ((SELECT id FROM domains WHERE domains.domain = ?), ?);
        SET @canonical_url_id := (SELECT id FROM urls WHERE url = ? LIMIT 1);
        UPDATE urls
          SET canonical_url_id = @canonical_url_id,
          article_id = ?
          WHERE id = ?;
        COMMIT;
      `, [
        canonical_url_domain,
        canonical_url_domain, canonical_url,
        canonical_url,
        article_id,
        url_pojo.id
      ])
    })
  })
}).finally(() => {
  process.exit()
})
