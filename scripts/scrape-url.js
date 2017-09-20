const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')
const request = require('request-promise')
const parseHtml = require('../lib/parseHtml')
const _ = require('lodash')
const getQGroups = require('../lib/getQGroups')
const urljs = require('url')
const JSDOM = require('jsdom').JSDOM
const Promise = require('bluebird')
const getSecret = require('../lib/getSecret')

let hostname_pojos

return mysqlQuery(`
  START TRANSACTION;
  SET @url_id := (
    SELECT urls.id FROM domains, urls
      WHERE domains.id = urls.domain_id
        AND domains.is_ignored = 0
        AND urls.created_at > NOW() - INTERVAL 48 HOUR
      ORDER BY scrape_priority DESC, scraped_at ASC
      LIMIT 1
  );
  UPDATE urls SET scraped_at = NOW(), scrape_priority = 0 WHERE id = @url_id;
  SELECT urls.*, domains.publisher_id AS publisher_id
    FROM urls, domains
    WHERE urls.id = @url_id
      AND urls.domain_id = domains.id;
  COMMIT;
`).then((results) => {
  const url_pojos = results[3]
  if (url_pojos.length === 0) {
    return
  }
  const url_pojo = url_pojos[0]
  console.log(url_pojo.id)
  return getSecret('proxies').then((_proxies) => {
    proxy = _.shuffle(_proxies.split('\n'))[0]
    return request(url_pojo.url, {
      resolveWithFullResponse: true,
      timeout: 5000,
      proxy: proxy
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
      } else if (url_pojo.domain_id === 2258) {
        const jsdom = new JSDOM(response.body)
        special_title = jsdom.window.document.querySelector('.blog-title').textContent
      }

      const title = special_title || parsed.meta['og:title'] || parsed.title
      const author = parsed.meta['article:author'] || parsed.meta.author
      const description = parsed.meta['og:description'] || parsed.description
      const image = parsed.meta['og:image']
      const canonical_url = urls[0]
      const canonical_url_domain = urljs.parse(canonical_url).hostname
      const is_canonical = (url_pojo.url === canonical_url)
      console.log(is_canonical)

      let article_insert

      if (url_pojo.article_id === null) {
        article_insert = mysqlQuery(`
          INSERT INTO articles(title, author, description, image, publisher_id)
            VALUES (?, ?, ?, ?, ?);
        `, [
          title,
          author,
          description,
          image,
          url_pojo.publisher_id,
          url_pojo.publisher_name
        ])
      } else {
        article_insert = mysqlQuery(`
          UPDATE articles SET title = ?, author = ?, description = ?, image = ? where id = ?
        `, [
          title,
          author,
          description,
          image,
          url_pojo.article_id
        ])
      }

      return article_insert.then((results) => {

        const article_id = url_pojo.article_id ? url_pojo.article_id : results.insertId

        console.log(article_id)

        let canonical_url_insert = null

        if (is_canonical) {
          canonical_url_insert = Promise.resolve()
        } else {
          canonical_url_insert = mysqlQuery(`
            INSERT IGNORE INTO domains(domain) VALUES (?);
            INSERT IGNORE INTO urls(domain_id, url, article_id, scraped_at) VALUES (
              (SELECT id FROM domains WHERE domains.domain = ? LIMIT 1),
              ?,
              ?,
              NOW()
            );
          `, [
            canonical_url_domain,
            canonical_url_domain, canonical_url, article_id
          ])
        }

        return canonical_url_insert.then((results) => {

          let update_urls_query = `
            UPDATE urls SET canonical_url_id = ?, article_id = ? WHERE id = ?;
          `
          const canonical_url_id = is_canonical ? url_pojo.id : results[1].insertId
          console.log(canonical_url_id)
          const update_urls_values = [canonical_url_id, article_id, url_pojo.id]

          if (!is_canonical) {
            update_urls_query += `
              UPDATE urls SET canonical_url_id = ? WHERE id = ?;
            `
            update_urls_values.push(canonical_url_id, canonical_url_id)
          }

          return mysqlQuery(update_urls_query, update_urls_values)
        })
      })
    })
  })
}).finally(() => {
  return mysqlDisconnect()
})
