const connection = require('../lib/connection')
const _ = require('lodash')
const getQs = require('../lib/getQs')
const waterfall = require('promise-waterfall')


connection.query((`
  START TRANSACTION;
  SET @article_id := (
    SELECT articles.id FROM articles, urls
      WHERE urls.id = urls.canonical_url_id
      AND urls.article_id = articles.id
      ORDER BY articles.coallesced_at ASC, articles.id ASC
      LIMIT 1
  );
  UPDATE articles SET coallesced_at = NOW() WHERE id = @article_id;
  SELECT * FROM articles WHERE id = @article_id;
  COMMIT;
`)).then((results) => {
  const articles = results[3]
  const article = articles[0]
  console.log(article.id)
  return connection.query(`
    SELECT publishers.* FROM publishers, domains, urls
    WHERE
      urls.article_id = ?
      AND urls.domain_id = domains.id
      AND domains.publisher_id = publishers.id
    LIMIT 1
  `, [
    article.id
  ]).then((publishers) => {
    if (publishers.length === 0) {
      return
    }
    const publisher = publishers[0]
    return connection.query(`
      SELECT * FROM domains WHERE publisher_id = ?
    `, [publisher.id]).then((domains) => {
      const domain_ids = domains.map((domain) => {
        return domain.id
      })
      const domain_ids_qs = getQs(domain_ids.length)
      return connection.query(`
        SELECT articles.* FROM articles
          LEFT JOIN urls ON (urls.article_id = articles.id)
          LEFT JOIN domains ON (urls.domain_id = domains.id)
        WHERE
          domains.id IN (${domain_ids_qs})
          AND articles.id != ?
          AND articles.title = ?
        LIMIT 1
      `, domain_ids.concat([article.id, article.title]))
    }).then((duplicate_articles) => {
      console.log(duplicate_articles.length)
      if (duplicate_articles.length === 0) {
        return
      }
      const duplicate_article_ids = _.map(duplicate_articles, (duplicate_article) => {
        return duplicate_article.id
      })
      const duplicate_article_ids_qs = getQs(duplicate_article_ids.length)
      return connection.query(`
        DELETE FROM articles WHERE id IN (${duplicate_article_ids_qs});
        UPDATE urls SET article_id = ? WHERE article_id IN (${duplicate_article_ids_qs})
      `, duplicate_article_ids.concat([article.id]).concat(duplicate_article_ids)
      )
    }).then(() => {
      return connection.query(
        'SELECT * FROM urls WHERE article_id = ?', [article.id]
      ).then((urls) => {
        const url_ids = _.map(urls, (url) => {
          return url.id
        })
        const url_ids_qs = getQs(url_ids.length)
        return connection.query(`
          SELECT * FROM reddit_posts WHERE url_id IN (${url_ids_qs});
          SELECT count(id) FROM twitter_statuses_urls WHERE url_id IN (${url_ids_qs});
          `, url_ids.concat(url_ids)
        ).then((results) => {
          const reddit_posts = results[0]
          const twitter_statuses_count = results[1][0]['count(id)']
          const reddit_score = reddit_posts.reduce((_reddit_score, reddit_post) => {
            return _reddit_score + reddit_post.score
          }, 0)
          console.log(reddit_posts.length)
          console.log(reddit_score)
          console.log(twitter_statuses_count)

          return connection.query(`
            INSERT INTO article_snapshots(article_id, reddit_posts_count, twitter_statuses_count, reddit_score)
              VALUES(?, ?, ?, ?);
            UPDATE articles SET
              reddit_posts_count = ?, twitter_statuses_count = ?, reddit_score = ?
              WHERE id = ?;
          `, [
            article.id, reddit_posts.length, twitter_statuses_count, reddit_score,
            reddit_posts.length, twitter_statuses_count, reddit_score,
            article.id
          ])
        })
      })
    })
  })
}).finally(() => {
  connection.end()
})
