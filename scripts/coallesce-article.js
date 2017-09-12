const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')
const _ = require('lodash')
const getQs = require('../lib/getQs')
const waterfall = require('promise-waterfall')


mysqlQuery((`
  START TRANSACTION;
  SET @article_id := (
    SELECT articles.id FROM articles, urls
      WHERE urls.id = urls.canonical_url_id
        AND urls.article_id = articles.id
        AND facebook_share_count IS NOT NULL
        AND twitter_statuses_count IS NOT NULL
        AND articles.created_at > NOW() - INTERVAL 48 HOUR
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
  return mysqlQuery(`
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
    return mysqlQuery(`
      SELECT * FROM domains WHERE publisher_id = ?
    `, [publisher.id]).then((domains) => {
      const domain_ids = domains.map((domain) => {
        return domain.id
      })
      const domain_ids_qs = getQs(domain_ids.length)
      return mysqlQuery(`
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
      return mysqlQuery(`
        DELETE FROM articles WHERE id IN (${duplicate_article_ids_qs});
        UPDATE urls SET article_id = ? WHERE article_id IN (${duplicate_article_ids_qs})
      `, duplicate_article_ids.concat([article.id]).concat(duplicate_article_ids)
      )
    }).then(() => {
      return mysqlQuery(
        'SELECT * FROM urls WHERE article_id = ?', [article.id]
      ).then((url_pojos) => {

        let is_ready = true

        _.forEach(url_pojos, (url_pojo) => {
          if (
            !url_pojo.twitter_statuses_added_at
            || !url_pojo.facebook_snapshot_added_at
          ) {
            is_ready = false
            return false
          }
        })

        if (!is_ready) {
          return
        }


        const url_ids = _.map(url_pojos, (url) => {
          return url.id
        })
        const url_ids_qs = getQs(url_ids.length)
        return mysqlQuery(`
          SELECT * FROM reddit_posts WHERE url_id IN (${url_ids_qs});
          SELECT count(id) FROM twitter_statuses_urls WHERE url_id IN (${url_ids_qs});
          `, url_ids.concat(url_ids)
        ).then((results) => {
          const reddit_posts = results[0]
          const twitter_statuses_count = results[1][0]['count(id)']
          const reddit_score = reddit_posts.reduce((sum, reddit_post) => {
            return sum + reddit_post.score
          }, 0)
          const facebook_share_count = url_pojos.reduce((sum, url_pojo) => {
            return sum + url_pojo.facebook_share_count
          }, 0)
          const facebook_comment_count = url_pojos.reduce((sum, url_pojo) => {
            return sum + url_pojo.facebook_comment_count
          }, 0)
          console.log(reddit_posts.length)
          console.log(reddit_score)
          console.log(twitter_statuses_count)
          console.log(facebook_share_count)
          console.log(facebook_comment_count)

          return mysqlQuery(`
            INSERT INTO article_snapshots(
                article_id,
                reddit_posts_count,
                twitter_statuses_count,
                reddit_score,
                facebook_share_count,
                facebook_comment_count
              )
              VALUES(?, ?, ?, ?, ?, ?);
            UPDATE articles SET
              reddit_posts_count = ?,
              twitter_statuses_count = ?,
              reddit_score = ?,
              facebook_share_count = ?,
              facebook_comment_count = ?
              WHERE id = ?;
          `, [
            article.id,
            reddit_posts.length,
            twitter_statuses_count,
            reddit_score,
            facebook_share_count,
            facebook_comment_count,
            reddit_posts.length,
            twitter_statuses_count,
            reddit_score,
            facebook_share_count,
            facebook_comment_count,
            article.id
          ])
        })
      })
    })
  })
}).finally(() => {
  return mysqlDisconnect()
})
