const restify = require('restify')
const mysqlQuery = require('./lib/mysqlQuery')
const _ = require('lodash')

const server = restify.createServer({
  name: 'headminer',
  version: '1.0.0'
})

server.use(restify.plugins.acceptParser(server.acceptable))
server.use(restify.plugins.queryParser())
server.use(restify.plugins.bodyParser())
server.use(function crossOrigin(req,res,next){
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "X-Requested-With")
  return next()
})

server.get('/articles/:id', function (req, res, next) {
  mysqlQuery('SELECT * FROM articles WHERE id = ?', [req.params.id]).then((articles) => {
    const article = articles[0]
    return mysqlQuery(`
      SELECT * FROM urls WHERE article_id = ?;
      SELECT * FROM article_snapshots WHERE article_id = ? ORDER BY created_at ASC;
      SELECT
          twitter_influencers.*,
          twitter_articles_influences.influence,
          twitter_articles_influences.adjusted_influence
        FROM twitter_influencers, twitter_articles_influences
        WHERE
          twitter_articles_influences.article_id = ?
          AND twitter_influencers.id = twitter_articles_influences.influencer_id
          AND twitter_influencers.is_ignored = 0
        ORDER BY twitter_articles_influences.adjusted_influence DESC;
    `, [article.id, article.id, article.id]).then((results) => {
      article.urls = results[0]
      article.snapshots = results[1]
      article.twitter_influencers = results[2]

      article.url = _.find(article.urls, (url) => {
        return url.id === url.canonical_url_id
      })

      return mysqlQuery(`
        SELECT * FROM domains WHERE id = ?;
        SELECT publishers.* FROM publishers, domains WHERE domains.id = ? AND domains.publisher_id = publishers.id
      `, [article.url.domain_id, article.url.domain_id]).then((results) => {
        article.domain = results[0][0]
        article.publisher = results[1][0]
        res.send(article)
        next()
      })
    })
  })
})

server.get('/hot/', function (req, res, next) {
  mysqlQuery('SELECT id FROM articles ORDER BY heat DESC LIMIT 10', []).then((articles) => {
    const ids = articles.map((article) => {
      return article.id
    })
    res.send(ids)
    next()
  })
})

server.get('/jobs/', function (req, res, next) {
  mysqlQuery('SELECT * FROM jobs ORDER BY id DESC LIMIT 1000', []).then((jobs) => {
    res.send(jobs)
    next()
  })
})

server.get('/twitter-influencers/:id', function (req, res, next) {
  console.log(req.params.id)
  mysqlQuery('SELECT * FROM twitter_influencers WHERE id = ?', [req.params.id]).then((influencers) => {
    res.send(influencers[0])
    next()
  })
})

server.get('/twitter-influencers/:id/high-influence-articles', (req, res, next) => {
  return mysqlQuery(`
    SELECT articles.id FROM articles, twitter_articles_influences
    WHERE articles.id = twitter_articles_influences.article_id
      AND twitter_articles_influences.adjusted_influence > 1
      AND twitter_articles_influences.influencer_id = ?
    ORDER BY articles.heat DESC
    LIMIT 10
  `, [req.params.id]).then((articles) => {
    res.send(_.map(articles, 'id'))
    next()
  })
})

server.get('/twitter-influencers/:id/low-influence-articles', (req, res, next) => {
  return mysqlQuery(`
    SELECT articles.id FROM articles, twitter_articles_influences
    WHERE articles.id = twitter_articles_influences.article_id
      AND twitter_articles_influences.adjusted_influence < -1
      AND twitter_articles_influences.influencer_id = ?
    ORDER BY articles.heat DESC
    LIMIT 10
  `, [req.params.id]).then((articles) => {
    res.send(_.map(articles, 'id'))
    next()
  })
})

server.listen(4001, function () {
  console.log('%s listening at %s', server.name, server.url);
})
